import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import cron from 'node-cron'
import { db, runMigrations } from './db/index.js'
import { projects, files, fastMetrics, deepMetrics, syncLog, oauthTokens, branches } from './db/schema.js'
import { runSync, isSyncRunning } from './sync.js'
import { getDeepMetrics } from './figmaApi.js'
import { exchangeCode, getValidToken, isConnected } from './auth.js'
import { eq, desc } from 'drizzle-orm'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isProd = process.env.NODE_ENV === 'production'

runMigrations()

const app = express()
app.use(express.json())

// ── OAuth ───────────────────────────────────────────────────────────────────

app.get('/api/auth/status', async (_req, res) => {
  res.json({ connected: await isConnected() })
})

app.get('/api/auth/connect', (_req, res) => {
  const clientId = process.env.FIGMA_CLIENT_ID
  const redirectUri = process.env.FIGMA_REDIRECT_URI
  if (!clientId || !redirectUri) {
    res.status(500).send('FIGMA_CLIENT_ID or FIGMA_REDIRECT_URI not set')
    return
  }
  const state = Math.random().toString(36).slice(2)
  const url = new URL('https://www.figma.com/oauth')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', 'current_user:read,file_content:read,file_metadata:read,projects:read')
  url.searchParams.set('state', state)
  url.searchParams.set('response_type', 'code')
  res.redirect(url.toString())
})

app.post('/api/auth/logout', async (_req, res) => {
  await db.delete(oauthTokens)
  res.json({ ok: true })
})

app.get('/oauth/callback', async (req, res) => {
  const { code, error } = req.query as Record<string, string>
  if (error) { res.status(400).send(`Figma OAuth error: ${error}`); return }
  if (!code) { res.status(400).send('Missing code'); return }
  try {
    await exchangeCode(code)
    // Kick off initial sync right after connecting
    if (!isSyncRunning()) runSync().catch((err) => console.error('Post-connect sync error:', err))
    res.redirect('/')
  } catch (err) {
    res.status(500).send(`Token exchange failed: ${(err as Error).message}`)
  }
})

// ── Data API ────────────────────────────────────────────────────────────────

app.get('/api/data', async (_req, res) => {
  const allProjects = await db.select().from(projects)
  const allFiles = await db.select().from(files)
  const allFast = await db.select().from(fastMetrics)
  const allDeep = await db.select().from(deepMetrics)
  const allBranches = await db.select().from(branches)
  const lastSync = await db.select().from(syncLog)
    .orderBy(desc(syncLog.id)).limit(1)

  const fastByKey = Object.fromEntries(allFast.map((m) => [m.fileKey, m]))
  const deepByKey = Object.fromEntries(allDeep.map((m) => [m.fileKey, m]))
  const branchesByParent = allBranches.reduce<Record<string, typeof allBranches>>((acc, b) => {
    ;(acc[b.parentFileKey] ??= []).push(b)
    return acc
  }, {})

  const result = allProjects.map((p) => ({
    projectId: p.id,
    projectName: p.name,
    teamId: p.teamId,
    files: allFiles
      .filter((f) => f.projectId === p.id)
      .map((f) => ({
        key: f.key,
        name: f.name,
        thumbnailUrl: f.thumbnailUrl,
        lastModified: f.lastModified,
        isLibrary: f.isLibrary === 1,
        branches: (branchesByParent[f.key] ?? []).map((b) => ({
          branchKey: b.branchKey,
          name: b.name,
          estimatedRamMB: b.estimatedRamMb,
        })),
        fastMetrics: fastByKey[f.key] ? {
          pageCount: fastByKey[f.key].pageCount,
          frameCount: fastByKey[f.key].frameCount,
          componentCount: fastByKey[f.key].componentCount,
          complexityScore: fastByKey[f.key].complexityScore,
        } : null,
        deepMetrics: deepByKey[f.key] ? {
          jsonSizeMB: deepByKey[f.key].jsonSizeMb,
          nodeCount: deepByKey[f.key].nodeCount,
          estimatedRamMB: deepByKey[f.key].estimatedRamMb,
          fetchedAt: deepByKey[f.key].fetchedAt,
        } : null,
      })),
  }))

  res.json({ projects: result, lastSync: lastSync[0] ?? null })
})

// ── Deep scan (on-demand) ───────────────────────────────────────────────────

app.post('/api/files/:key/deep-scan', async (req, res) => {
  const { key } = req.params
  try {
    const pat = await getValidToken()
    const m = await getDeepMetrics(pat, key)
    await db.insert(deepMetrics).values({
      fileKey: key,
      jsonSizeMb: m.jsonSizeMb,
      nodeCount: m.nodeCount,
      estimatedRamMb: m.estimatedRamMb,
      fetchedAt: Date.now(),
    }).onConflictDoUpdate({
      target: deepMetrics.fileKey,
      set: { jsonSizeMb: m.jsonSizeMb, nodeCount: m.nodeCount, estimatedRamMb: m.estimatedRamMb, fetchedAt: Date.now() },
    })
    res.json({ jsonSizeMB: m.jsonSizeMb, nodeCount: m.nodeCount, estimatedRamMB: m.estimatedRamMb })
  } catch (err) {
    res.status(502).json({ error: (err as Error).message })
  }
})

// ── Sync control ────────────────────────────────────────────────────────────

app.post('/api/sync', async (_req, res) => {
  if (isSyncRunning()) {
    res.json({ status: 'already_running' })
    return
  }
  runSync().catch((err) => console.error('Sync error:', err))
  res.json({ status: 'started' })
})

app.get('/api/sync/status', async (_req, res) => {
  const last = await db.select().from(syncLog).orderBy(desc(syncLog.id)).limit(1)
  res.json({ lastSync: last[0] ?? null, isRunning: isSyncRunning() })
})

// ── Static frontend ─────────────────────────────────────────────────────────

if (isProd) {
  const distPath = path.join(__dirname, '../dist')
  app.use(express.static(distPath))
  app.use((_req, res) => res.sendFile(path.join(distPath, 'index.html')))
}

// ── Start ───────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? 3001)
app.listen(port, '0.0.0.0', () => console.log(`Server: http://0.0.0.0:${port}`))

// Daily sync at 06:00 UTC (configurable via SYNC_CRON env var)
const cronSchedule = process.env.SYNC_CRON ?? '0 6 * * *'
cron.schedule(cronSchedule, () => {
  console.log('Cron: starting scheduled sync...')
  runSync().catch((err) => console.error('Cron sync error:', err))
})
console.log(`Sync scheduled: ${cronSchedule}`)

// Auto-sync on startup if DB is empty and already connected
isConnected().then((connected) => {
  if (!connected) return
  db.select().from(syncLog).limit(1).then((rows) => {
    if (rows.length === 0) {
      console.log('No previous sync found. Running initial sync...')
      runSync().catch((err) => console.error('Initial sync error:', err))
    }
  })
})
