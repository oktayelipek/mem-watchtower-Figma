import { useState, useCallback, useEffect, useMemo } from 'react'
import type { ProjectData, FileData } from './types/figma'
import { getRiskLevel } from './lib/metrics'
import { FilesTable } from './components/FilesTable'
import { SortControls, type SortKey, type RiskFilter } from './components/SortControls'
import { ProjectCards } from './components/ProjectCards'

interface SyncStatus {
  id: number
  startedAt: number
  finishedAt: number | null
  filesSynced: number | null
  status: string | null
}

export default function App() {
  const [connected, setConnected] = useState<boolean | null>(null)
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [lastSync, setLastSync] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('complexity')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [projectFilter, setProjectFilter] = useState('')

  const loadData = useCallback(async () => {
    const authRes = await fetch('/api/auth/status')
    const { connected: c } = await authRes.json()
    setConnected(c)
    if (!c) { setLoading(false); return }

    try {
      const res = await fetch('/api/data')
      const data = await res.json() as {
        projects: Array<{
          projectId: string
          projectName: string
          files: Array<{
            key: string
            name: string
            thumbnailUrl: string | null
            lastModified: string
            fastMetrics: { pageCount: number; frameCount: number; componentCount: number; complexityScore: number } | null
            deepMetrics: { jsonSizeMB: number; nodeCount: number; estimatedRamMB: number; fetchedAt: number | null } | null
          }>
        }>
        lastSync: SyncStatus | null
      }

      const mapped: ProjectData[] = data.projects.map((p) => ({
        projectId: p.projectId,
        projectName: p.projectName,
        expanded: p.files.length > 0,
        metricsLoaded: true,
        files: p.files.map((f): FileData => ({
          key: f.key,
          name: f.name,
          thumbnail_url: f.thumbnailUrl ?? '',
          last_modified: f.lastModified,
          fastMetrics: f.fastMetrics,
          deepMetrics: f.deepMetrics ? { ...f.deepMetrics, fetchedAt: f.deepMetrics.fetchedAt ?? null } : null,
          loadingFast: false,
          loadingDeep: false,
          errorFast: null,
          errorDeep: null,
        })),
      }))

      setProjects(mapped)
      setLastSync(data.lastSync)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Auto-poll if a background sync is already running when the page loads
  useEffect(() => {
    let poll: ReturnType<typeof setInterval> | null = null
    fetch('/api/sync/status')
      .then((r) => r.json())
      .then(({ isRunning }) => {
        if (!isRunning) return
        setSyncing(true)
        poll = setInterval(async () => {
          const res = await fetch('/api/sync/status')
          const { isRunning: still, lastSync: ls } = await res.json()
          if (!still) {
            clearInterval(poll!)
            setSyncing(false)
            setLastSync(ls)
            loadData()
          }
        }, 3000)
      })
      .catch(() => {})
    return () => { if (poll) clearInterval(poll) }
  }, [])

  const deepScanFile = useCallback(async (projectId: string, fileKey: string) => {
    setProjects((prev) =>
      prev.map((proj) =>
        proj.projectId !== projectId ? proj : {
          ...proj,
          files: proj.files.map((f) =>
            f.key === fileKey ? { ...f, loadingDeep: true, errorDeep: null } : f
          ),
        }
      )
    )

    try {
      const res = await fetch(`/api/files/${fileKey}/deep-scan`, { method: 'POST' })
      if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`)
      const metrics = await res.json() as { jsonSizeMB: number; nodeCount: number; estimatedRamMB: number }
      setProjects((prev) =>
        prev.map((proj) =>
          proj.projectId !== projectId ? proj : {
            ...proj,
            files: proj.files.map((f) =>
              f.key === fileKey ? { ...f, deepMetrics: { ...metrics, fetchedAt: Date.now() }, loadingDeep: false } : f
            ),
          }
        )
      )
    } catch (err) {
      setProjects((prev) =>
        prev.map((proj) =>
          proj.projectId !== projectId ? proj : {
            ...proj,
            files: proj.files.map((f) =>
              f.key === fileKey ? { ...f, loadingDeep: false, errorDeep: (err as Error).message } : f
            ),
          }
        )
      )
    }
  }, [])

  const deepScanAll = useCallback(async () => {
    for (const proj of projects) {
      for (const f of proj.files) {
        if (!f.deepMetrics) await deepScanFile(proj.projectId, f.key)
      }
    }
  }, [projects, deepScanFile])

  const deepScanProject = useCallback(async (projectId: string) => {
    const proj = projects.find((p) => p.projectId === projectId)
    if (!proj) return
    for (const f of proj.files) {
      if (!f.deepMetrics) await deepScanFile(projectId, f.key)
    }
  }, [projects, deepScanFile])

  const triggerSync = useCallback(async () => {
    setSyncing(true)
    try {
      await fetch('/api/sync', { method: 'POST' })
      // Poll until sync is done
      const poll = setInterval(async () => {
        const res = await fetch('/api/sync/status')
        const { isRunning, lastSync: ls } = await res.json()
        if (!isRunning) {
          clearInterval(poll)
          setSyncing(false)
          setLastSync(ls)
          await loadData()
        }
      }, 3000)
    } catch {
      setSyncing(false)
    }
  }, [loadData])

  const filteredProjects = useMemo(() =>
    projectFilter ? projects.filter((p) => p.projectId === projectFilter) : projects,
    [projects, projectFilter]
  )

  const visibleFileKeys = useMemo(() => {
    const q = search.trim().toLowerCase()
    return new Set(
      filteredProjects.flatMap((p) => p.files).filter((f) => {
        if (q && !f.name.toLowerCase().includes(q)) return false
        if (riskFilter === 'all') return true
        if (riskFilter === 'unscanned') return !f.deepMetrics
        return getRiskLevel(f.fastMetrics, f.deepMetrics) === riskFilter
      }).map((f) => f.key)
    )
  }, [filteredProjects, search, riskFilter])

  const isFiltering = search.trim() !== '' || riskFilter !== 'all'
  const totalFiles = filteredProjects.reduce((acc, p) => acc + p.files.length, 0)

  const lastSyncLabel = lastSync
    ? lastSync.status === 'running'
      ? 'Syncing…'
      : `Last sync: ${new Date(lastSync.finishedAt ?? lastSync.startedAt).toLocaleString()} · ${lastSync.filesSynced ?? 0} files`
    : 'Never synced'

  if (connected === false) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-6 max-w-sm w-full">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-violet-600/20 border border-violet-500/30">
            <svg className="w-7 h-7 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Watchtower</h1>
            <p className="text-slate-500 text-sm mt-1">Figma RAM Monitor</p>
          </div>
          <a
            href="/api/auth/connect"
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg bg-[#1e1e1e] border border-slate-700 hover:border-slate-500 text-slate-100 font-medium transition-colors"
          >
            <FigmaIcon />
            Connect Figma
          </a>
          <p className="text-xs text-slate-600">Read-only access. Tokens are stored server-side only.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
            </svg>
            <span className="font-bold text-slate-100">Watchtower</span>
            <span className="text-xs text-slate-500 border border-slate-700 rounded px-2 py-0.5">Figma RAM Monitor</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-600">{lastSyncLabel}</span>
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-40"
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' })
                setConnected(false)
                setProjects([])
                setLastSync(null)
              }}
              className="text-xs text-slate-600 hover:text-red-400 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-800 bg-slate-950/60">
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-green-500" /><span>Low (&lt;40%)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-amber-500" /><span>Medium (40–70%)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-red-500" /><span>High (&gt;70%) — near 2 GB limit</span></div>
          <span className="ml-auto text-slate-600">Fast: relative complexity · Deep: JSON ×7 ≈ estimated RAM</span>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6 space-y-4">
        {loading ? (
          <div className="text-center py-20 text-slate-500">
            <div className="animate-spin w-8 h-8 border-2 border-slate-700 border-t-violet-500 rounded-full mx-auto mb-4" />
            <p>Loading…</p>
          </div>
        ) : (
          <>
            <ProjectCards
              projects={projects}
              activeProjectId={projectFilter}
              onProjectFilter={setProjectFilter}
              onScanProject={deepScanProject}
            />

            <SortControls
              sort={sort} onSort={setSort}
              riskFilter={riskFilter} onRiskFilter={setRiskFilter}
              search={search} onSearch={setSearch}
              totalProjects={filteredProjects.length} totalFiles={totalFiles}
            />

            {projects.length === 0 ? (
              <div className="text-center py-20 text-slate-500 space-y-3">
                <p>No data yet.</p>
                <button
                  onClick={triggerSync}
                  disabled={syncing}
                  className="text-xs px-4 py-2 rounded-md bg-violet-600 hover:bg-violet-500 text-white transition-colors disabled:opacity-40"
                >
                  {syncing ? 'Syncing…' : 'Run first sync'}
                </button>
              </div>
            ) : (
              <>
                <FilesTable
                  projects={filteredProjects}
                  sort={sort}
                  visibleFileKeys={isFiltering ? visibleFileKeys : undefined}
                  onDeepScanAll={deepScanAll}
                />
                {isFiltering && visibleFileKeys.size === 0 && (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    No files match the current filters.
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function FigmaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 28.5C19 25.9804 20.0009 23.5641 21.7825 21.7825C23.5641 20.0009 25.9804 19 28.5 19C31.0196 19 33.4359 20.0009 35.2175 21.7825C36.9991 23.5641 38 25.9804 38 28.5C38 31.0196 36.9991 33.4359 35.2175 35.2175C33.4359 36.9991 31.0196 38 28.5 38C25.9804 38 23.5641 36.9991 21.7825 35.2175C20.0009 33.4359 19 31.0196 19 28.5Z" fill="#1ABCFE"/>
      <path d="M0 47.5C0 44.9804 1.00089 42.5641 2.78249 40.7825C4.56408 39.0009 6.98044 38 9.5 38H19V47.5C19 50.0196 17.9991 52.4359 16.2175 54.2175C14.4359 55.9991 12.0196 57 9.5 57C6.98044 57 4.56408 55.9991 2.78249 54.2175C1.00089 52.4359 0 50.0196 0 47.5Z" fill="#0ACF83"/>
      <path d="M19 0V19H28.5C31.0196 19 33.4359 17.9991 35.2175 16.2175C36.9991 14.4359 38 12.0196 38 9.5C38 6.98044 36.9991 4.56408 35.2175 2.78249C33.4359 1.00089 31.0196 0 28.5 0H19Z" fill="#FF7262"/>
      <path d="M0 9.5C0 12.0196 1.00089 14.4359 2.78249 16.2175C4.56408 17.9991 6.98044 19 9.5 19H19V0H9.5C6.98044 0 4.56408 1.00089 2.78249 2.78249C1.00089 4.56408 0 6.98044 0 9.5Z" fill="#F24E1E"/>
      <path d="M0 28.5C0 31.0196 1.00089 33.4359 2.78249 35.2175C4.56408 36.9991 6.98044 38 9.5 38H19V19H9.5C6.98044 19 4.56408 20.0009 2.78249 21.7825C1.00089 23.5641 0 25.9804 0 28.5Z" fill="#A259FF"/>
    </svg>
  )
}
