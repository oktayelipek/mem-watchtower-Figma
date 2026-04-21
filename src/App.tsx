import { useState, useCallback, useEffect, useMemo } from 'react'
import type { ProjectData, FileData } from './types/figma'
import { getRiskLevel } from './lib/metrics'
import { FileAccordion } from './components/FileAccordion'
import { SortControls, type SortKey, type RiskFilter } from './components/SortControls'
import { RiskSummary } from './components/RiskSummary'

interface SyncStatus {
  id: number
  startedAt: number
  finishedAt: number | null
  filesSynced: number | null
  status: string | null
}

export default function App() {
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [lastSync, setLastSync] = useState<SyncStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<SortKey>('complexity')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)

  const loadData = useCallback(async () => {
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
            deepMetrics: { jsonSizeMB: number; nodeCount: number; estimatedRamMB: number } | null
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
          deepMetrics: f.deepMetrics,
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
              f.key === fileKey ? { ...f, deepMetrics: metrics, loadingDeep: false } : f
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

  const deepScanAll = useCallback(async (projectId: string) => {
    const proj = projects.find((p) => p.projectId === projectId)
    if (!proj) return
    for (const f of proj.files) await deepScanFile(projectId, f.key)
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

  const toggleProject = useCallback((projectId: string) => {
    setProjects((prev) =>
      prev.map((p) => p.projectId === projectId ? { ...p, expanded: !p.expanded } : p)
    )
  }, [])

  const toggleAll = useCallback(() => {
    setProjects((prev) => {
      const anyCollapsed = prev.some((p) => !p.expanded)
      return prev.map((p) => ({ ...p, expanded: anyCollapsed }))
    })
  }, [])

  const visibleFileKeys = useMemo(() => {
    const q = search.trim().toLowerCase()
    return new Set(
      projects.flatMap((p) => p.files).filter((f) => {
        if (q && !f.name.toLowerCase().includes(q)) return false
        if (riskFilter === 'all') return true
        if (riskFilter === 'unscanned') return !f.deepMetrics
        return getRiskLevel(f.fastMetrics, f.deepMetrics) === riskFilter
      }).map((f) => f.key)
    )
  }, [projects, search, riskFilter])

  const isFiltering = search.trim() !== '' || riskFilter !== 'all'

  const sortedProjects = useMemo(() => [...projects].sort((a, b) => {
    if (sort === 'name') return a.projectName.localeCompare(b.projectName)
    const score = (proj: ProjectData) =>
      sort === 'ram'
        ? Math.max(...proj.files.map((f) => f.deepMetrics?.estimatedRamMB ?? 0), 0)
        : proj.files.reduce((acc, f) => acc + (f.fastMetrics?.complexityScore ?? 0), 0)
    return score(b) - score(a)
  }), [projects, sort])

  const totalFiles = projects.reduce((acc, p) => acc + p.files.length, 0)
  const allExpanded = projects.length > 0 && projects.every((p) => p.expanded)

  const lastSyncLabel = lastSync
    ? lastSync.status === 'running'
      ? 'Syncing…'
      : `Last sync: ${new Date(lastSync.finishedAt ?? lastSync.startedAt).toLocaleString()} · ${lastSync.filesSynced ?? 0} files`
    : 'Never synced'

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
            <RiskSummary projects={projects} onFilter={setRiskFilter} activeFilter={riskFilter} />

            <SortControls
              sort={sort} onSort={setSort}
              riskFilter={riskFilter} onRiskFilter={setRiskFilter}
              search={search} onSearch={setSearch}
              totalProjects={projects.length} totalFiles={totalFiles}
              allExpanded={allExpanded} onToggleAll={toggleAll}
            />

            <div className="space-y-3">
              {sortedProjects.map((proj) => (
                <FileAccordion
                  key={proj.projectId}
                  data={proj}
                  onToggle={() => toggleProject(proj.projectId)}
                  onDeepScanFile={(fileKey) => deepScanFile(proj.projectId, fileKey)}
                  onDeepScanAll={() => deepScanAll(proj.projectId)}
                  visibleFileKeys={isFiltering ? visibleFileKeys : undefined}
                />
              ))}
            </div>

            {projects.length === 0 && !loading && (
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
            )}

            {isFiltering && visibleFileKeys.size === 0 && projects.length > 0 && (
              <div className="text-center py-12 text-slate-500 text-sm">
                No files match the current filters.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
