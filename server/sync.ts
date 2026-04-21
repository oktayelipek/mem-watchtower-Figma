import { db } from './db/index.js'
import { projects, files, fastMetrics, syncLog } from './db/schema.js'
import { getTeamProjects, getProjectFiles, getFastMetrics, pLimit } from './figmaApi.js'
import { getValidToken } from './auth.js'
import { eq } from 'drizzle-orm'

const TEAM_IDS = [...new Set(
  (process.env.VITE_FIGMA_TEAM_IDS ?? '')
    .split(',').map((s) => s.trim()).filter(Boolean)
)]

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
