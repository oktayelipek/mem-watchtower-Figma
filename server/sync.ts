import { db } from './db/index.js'
import { projects, files, fastMetrics, deepMetrics, syncLog, branches } from './db/schema.js'
import { getTeamProjects, getProjectFiles, getFastMetrics, getDeepMetrics, getTeamLibraryFileKeys, getFileBranches, pLimit } from './figmaApi.js'
import { getValidToken } from './auth.js'
import { eq } from 'drizzle-orm'

const TEAM_IDS = [...new Set(
  (process.env.VITE_FIGMA_TEAM_IDS ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean)
)]

const WATCH_PROJECTS = new Set(
  (process.env.WATCH_PROJECTS ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean)
)

const PROJECT_RENAMES: Record<string, string> = {
  'Main Kripto': 'SSO Main',
}

let syncRunning = false

export function isSyncRunning() {
  return syncRunning
}

export async function runSync(): Promise<void> {
  if (syncRunning) {
    console.log('Sync already in progress, skipping.')
    return
  }

  if (TEAM_IDS.length === 0) throw new Error('VITE_FIGMA_TEAM_IDS is empty')

  syncRunning = true
  const now = Date.now()

  const [logEntry] = await db.insert(syncLog).values({
    startedAt: now,
    status: 'running',
  }).returning()

  let filesSynced = 0

  try {
    const pat = await getValidToken()

    // Fetch all projects from all teams
    const projectsByTeam = await pLimit(
      TEAM_IDS.map((teamId) => () => getTeamProjects(pat, teamId).then((ps) =>
        ps.map((p) => ({ ...p, teamId }))
      )),
      5,
    )
    const allProjects = projectsByTeam.flat()
      .map((p) => ({ ...p, name: PROJECT_RENAMES[p.name] ?? p.name }))
      .filter((p) => WATCH_PROJECTS.size === 0 || WATCH_PROJECTS.has(p.name))

    // Upsert projects
    for (const p of allProjects) {
      await db.insert(projects).values({
        id: p.id,
        name: p.name,
        teamId: p.teamId,
        syncedAt: now,
      }).onConflictDoUpdate({
        target: projects.id,
        set: { name: p.name, syncedAt: now },
      })
    }

    // Fetch files for each project
    const allFiles: Array<{ key: string; name: string; thumbnail_url: string; last_modified: string; projectId: string }> = []

    await pLimit(
      allProjects.map((p) => async () => {
        try {
          const rawFiles = await getProjectFiles(pat, p.id)
          for (const f of rawFiles) {
            await db.insert(files).values({
              key: f.key,
              projectId: p.id,
              name: f.name,
              thumbnailUrl: f.thumbnail_url,
              lastModified: f.last_modified,
              syncedAt: now,
            }).onConflictDoUpdate({
              target: files.key,
              set: { name: f.name, thumbnailUrl: f.thumbnail_url, lastModified: f.last_modified, syncedAt: now },
            })
            allFiles.push({ ...f, projectId: p.id })
          }
        } catch (err) {
          console.error(`Project ${p.id} files failed:`, err)
        }
      }),
      5,
    )

    // Fetch fast metrics for each file
    await pLimit(
      allFiles.map((f) => async () => {
        try {
          const m = await getFastMetrics(pat, f.key)
          await db.insert(fastMetrics).values({
            fileKey: f.key,
            pageCount: m.pageCount,
            frameCount: m.frameCount,
            componentCount: m.componentCount,
            complexityScore: m.complexityScore,
            fetchedAt: Date.now(),
          }).onConflictDoUpdate({
            target: fastMetrics.fileKey,
            set: {
              pageCount: m.pageCount,
              frameCount: m.frameCount,
              componentCount: m.componentCount,
              complexityScore: m.complexityScore,
              fetchedAt: Date.now(),
            },
          })
          filesSynced++
        } catch (err) {
          console.error(`Fast metrics for ${f.key} failed:`, err)
        }
      }),
      5,
    )

    // Detect library files via team components API; fall back to component count heuristic
    const libraryFileKeys = new Set<string>()
    for (const teamId of TEAM_IDS) {
      const keys = await getTeamLibraryFileKeys(pat, teamId)
      keys.forEach((k) => libraryFileKeys.add(k))
    }
    const fastByKey = Object.fromEntries(
      (await db.select().from(fastMetrics)).map((r) => [r.fileKey, r])
    )
    await pLimit(
      allFiles.map((f) => async () => {
        const isLib = libraryFileKeys.size > 0
          ? libraryFileKeys.has(f.key)
          : (fastByKey[f.key]?.componentCount ?? 0) >= 50
        await db.update(files).set({ isLibrary: isLib ? 1 : 0 }).where(eq(files.key, f.key))
      }),
      5,
    )
    console.log(`Library detection done. ${libraryFileKeys.size > 0 ? `${libraryFileKeys.size} published components found via API` : 'Used component count heuristic'}.`)

    // Sync branch list for each file
    const deepByKey = Object.fromEntries(
      (await db.select().from(deepMetrics)).map((r) => [r.fileKey, r])
    )
    await pLimit(
      allFiles.map((f) => async () => {
        const fileBranches = await getFileBranches(pat, f.key)
        for (const branch of fileBranches) {
          await db.insert(branches).values({
            branchKey: branch.key,
            parentFileKey: f.key,
            name: branch.name,
            estimatedRamMb: deepByKey[branch.key]?.estimatedRamMb ?? null,
            fetchedAt: Date.now(),
          }).onConflictDoUpdate({
            target: branches.branchKey,
            set: {
              name: branch.name,
              estimatedRamMb: deepByKey[branch.key]?.estimatedRamMb ?? null,
              fetchedAt: Date.now(),
            },
          })
        }
      }),
      5,
    )

    // Deep scan: new files + stale files (older than STALE_SCAN_DAYS, default 7)
    const staleDays = Number(process.env.STALE_SCAN_DAYS ?? 7)
    const staleThreshold = Date.now() - staleDays * 86_400_000
    const existingDeep = await db.select({ fileKey: deepMetrics.fileKey, fetchedAt: deepMetrics.fetchedAt }).from(deepMetrics)
    const deepInfoByKey = Object.fromEntries(existingDeep.map((r) => [r.fileKey, r]))

    const filesToScan = allFiles.filter((f) => {
      const info = deepInfoByKey[f.key]
      if (!info) return true                    // never scanned
      return info.fetchedAt < staleThreshold    // stale
    })

    if (filesToScan.length > 0) {
      const newCount = filesToScan.filter((f) => !deepInfoByKey[f.key]).length
      const staleCount = filesToScan.length - newCount
      console.log(`Deep scanning ${filesToScan.length} files (${newCount} new, ${staleCount} stale >=${staleDays}d)…`)
      await pLimit(
        filesToScan.map((f) => async () => {
          try {
            const m = await getDeepMetrics(pat, f.key)
            await db.insert(deepMetrics).values({
              fileKey: f.key,
              jsonSizeMb: m.jsonSizeMb,
              nodeCount: m.nodeCount,
              estimatedRamMb: m.estimatedRamMb,
              fetchedAt: Date.now(),
            }).onConflictDoUpdate({
              target: deepMetrics.fileKey,
              set: { jsonSizeMb: m.jsonSizeMb, nodeCount: m.nodeCount, estimatedRamMb: m.estimatedRamMb, fetchedAt: Date.now() },
            })
          } catch (err) {
            console.error(`Deep scan for ${f.key} failed:`, err)
          }
        }),
        2,
      )
    }

    await db.update(syncLog)
      .set({ finishedAt: Date.now(), filesSynced, status: 'done' })
      .where(eq(syncLog.id, logEntry.id))

    console.log(`Sync complete: ${filesSynced} files synced.`)
  } catch (err) {
    await db.update(syncLog)
      .set({ finishedAt: Date.now(), status: 'error', error: String(err) })
      .where(eq(syncLog.id, logEntry.id))
    throw err
  } finally {
    syncRunning = false
  }
}
