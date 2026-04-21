import { useState, useCallback, useEffect, useMemo } from 'react'
import type { ProjectData, FileData } from './types/figma'
import { getMe, getTeamProjects, getProjectFiles, getFastMetrics, getDeepMetrics, pLimit } from './lib/figmaApi'
import { getRiskLevel } from './lib/metrics'
import { saveCache, loadCache, clearCache } from './lib/cache'
import { LoginScreen } from './components/TokenForm'
import { OAuthCallback } from './components/OAuthCallback'
import { FileAccordion } from './components/FileAccordion'
import { SortControls, type SortKey, type RiskFilter } from './components/SortControls'
import { RiskSummary } from './components/RiskSummary'

const TEAM_IDS = [...new Set(
  (import.meta.env.VITE_FIGMA_TEAM_IDS as string | undefined)
    ?.split(',').map((s) => s.trim()).filter(Boolean) ?? []
)]

type AppState =
  | { phase: 'login' }
  | { phase: 'callback' }
  | { phase: 'dashboard'; token: string; userName: string }

function getInitialState(): AppState {
  if (window.location.pathname === '/oauth/callback') return { phase: 'callback' }
  const token = sessionStorage.getItem('figma_token')
  const userName = sessionStorage.getItem('figma_user') ?? ''
  if (token) return { phase: 'dashboard', token, userName }
  return { phase: 'login' }
}

function makeFileData(f: { key: string; name: string; thumbnail_url: string; last_modified: string }): FileData {
  return {
    key: f.key,
    name: f.name,
    thumbnail_url: f.thumbnail_url,
    last_modified: f.last_modified,
    fastMetrics: null,
    deepMetrics: null,
    loadingFast: false,
    loadingDeep: false,
    errorFast: null,
    errorDeep: null,
  }
}

export default function App() {
  const [state, setState] = useState<AppState>(getInitialState)
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [sort, setSort] = useState<SortKey>('complexity')
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all')
  const [search, setSearch] = useState('')

  // Load fast metrics for a single project (called lazily on accordion open)
  const loadFastMetrics = useCallback(async (token: string, projectId: string, files: FileData[]) => {
    if (files.length === 0) return

    // Mark all files in this project as loading
    setProjects((prev) =>
      prev.map((p) =>
        p.projectId !== projectId ? p : {
          ...p,
          metricsLoaded: true,
          files: p.files.map((f) => ({ ...f, loadingFast: true })),
        }
      )
    )

    await pLimit(
      files.map((f) => async () => {
        try {
          const metrics = await getFastMetrics(token, f.key)
          setProjects((prev) =>
            prev.map((p) =>
              p.projectId !== projectId ? p : {
                ...p,
                files: p.files.map((file) =>
                  file.key === f.key ? { ...file, fastMetrics: metrics, loadingFast: false } : file
                ),
              }
            )
          )
        } catch (err) {
          setProjects((prev) =>
            prev.map((p) =>
              p.projectId !== projectId ? p : {
                ...p,
                files: p.files.map((file) =>
                  file.key === f.key ? { ...file, loadingFast: false, errorFast: (err as Error).message } : file
                ),
              }
            )
          )
        }
      }),
      3,
    )
  }, [])

  const loadStructure = useCallback(async (token: string) => {
    if (TEAM_IDS.length === 0) return

    // Check cache first
    const cached = loadCache()
    if (cached) {
      const restored: ProjectData[] = cached.projects.map((p) => ({
        projectId: p.id,
        projectName: p.name,
        files: (cached.filesByProject[p.id] ?? []).map(makeFileData),
        expanded: false,
        metricsLoaded: false,
      }))
      setProjects(restored)
      return
    }

    // Fetch projects from all teams
    const projectsByTeam = await pLimit(
      TEAM_IDS.map((teamId) => () => getTeamProjects(token, teamId)),
      5,
    )
    const allProjects = projectsByTeam.flat()

    setProjects(allProjects.map((p) => ({
      projectId: p.id,
      projectName: p.name,
      files: [],
      expanded: false,
      metricsLoaded: false,
    })))

    // Fetch file lists (no metrics yet)
    const filesByProject: Record<string, Array<{ key: string; name: string; thumbnail_url: string; last_modified: string }>> = {}

    await pLimit(
      allProjects.map((p) => async () => {
        try {
          const rawFiles = await getProjectFiles(token, p.id)
          filesByProject[p.id] = rawFiles
          const files = rawFiles.map(makeFileData)
          setProjects((prev) =>
            prev.map((proj) =>
              proj.projectId === p.id ? { ...proj, files, expanded: files.length > 0 } : proj
            )
          )
        } catch (err) {
          console.error(`Project ${p.id} failed:`, err)
        }
      }),
      5,
    )

    saveCache(allProjects, filesByProject)
  }, [])

  useEffect(() => {
    if (state.phase === 'dashboard' && projects.length === 0) {
      loadStructure(state.token)
    }
  }, [state, projects.length, loadStructure])

  const handleOAuthSuccess = useCallback(async (token: string) => {
    try {
      const me = await getMe(token)
      const userName: string = me.handle ?? me.email ?? 'Kullanıcı'
      sessionStorage.setItem('figma_token', token)
      sessionStorage.setItem('figma_user', userName)
      setState({ phase: 'dashboard', token, userName })
    } catch (err) {
      console.error('getMe failed:', err)
      setState({ phase: 'login' })
    }
  }, [])

  const handleOAuthError = useCallback((msg: string) => {
    console.error('OAuth error:', msg)
    setState({ phase: 'login' })
  }, [])

  const deepScanFile = useCallback(async (projectId: string, fileKey: string) => {
    if (state.phase !== 'dashboard') return

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
      const metrics = await getDeepMetrics(state.token, fileKey)
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
  }, [state])

  const deepScanAll = useCallback(async (projectId: string) => {
    const proj = projects.find((p) => p.projectId === projectId)
    if (!proj) return
    for (const f of proj.files) {
      await deepScanFile(projectId, f.key)
    }
  }, [projects, deepScanFile])

  const toggleProject = useCallback((projectId: string) => {
    if (state.phase !== 'dashboard') return
    setProjects((prev) => {
      const proj = prev.find((p) => p.projectId === projectId)
      if (!proj) return prev
      const willExpand = !proj.expanded
      // Trigger lazy metric load on first open
      if (willExpand && !proj.metricsLoaded && proj.files.length > 0) {
        loadFastMetrics(state.token, projectId, proj.files)
      }
      return prev.map((p) => p.projectId === projectId ? { ...p, expanded: willExpand } : p)
    })
  }, [state, loadFastMetrics])

  const toggleAll = useCallback(() => {
    if (state.phase !== 'dashboard') return
    setProjects((prev) => {
      const anyCollapsed = prev.some((p) => !p.expanded)
      if (anyCollapsed) {
        // Load metrics for all projects that haven't been loaded yet
        prev.forEach((p) => {
          if (!p.metricsLoaded && p.files.length > 0) {
            loadFastMetrics(state.token, p.projectId, p.files)
          }
        })
      }
      return prev.map((p) => ({ ...p, expanded: anyCollapsed }))
    })
  }, [state, loadFastMetrics])

  const visibleFileKeys = useMemo(() => {
    const q = search.trim().toLowerCase()
    const allFiles = projects.flatMap((p) => p.files)
    const filtered = allFiles.filter((f) => {
      if (q && !f.name.toLowerCase().includes(q)) return false
      if (riskFilter === 'all') return true
      if (riskFilter === 'unscanned') return !f.deepMetrics
      return getRiskLevel(f.fastMetrics, f.deepMetrics) === riskFilter
    })
    return new Set(filtered.map((f) => f.key))
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

  function handleLogout() {
    sessionStorage.removeItem('figma_token')
    sessionStorage.removeItem('figma_user')
    clearCache()
    setProjects([])
    setState({ phase: 'login' })
  }

  if (state.phase === 'callback') {
    return <OAuthCallback onSuccess={handleOAuthSuccess} onError={handleOAuthError} />
  }
  if (state.phase === 'login') {
    return <LoginScreen />
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
            <span className="text-xs text-slate-500 border border-slate-700 rounded px-2 py-0.5">Figma Branch Monitor</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">{state.userName}</span>
            <button
              onClick={() => { clearCache(); loadStructure(state.token) }}
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
              title="Cache'i temizle ve yenile"
            >
              Yenile
            </button>
            <button onClick={handleLogout} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Çıkış</button>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-800 bg-slate-950/60">
        <div className="max-w-6xl mx-auto px-6 py-2 flex items-center gap-6 text-xs text-slate-500">
          <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-green-500" /><span>Düşük (&lt;40%)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-amber-500" /><span>Orta (40–70%)</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-1.5 rounded-full bg-red-500" /><span>Yüksek (&gt;70%) — 2GB limitine yakın</span></div>
          <span className="ml-auto text-slate-600">Hızlı: göreli karmaşıklık · Derin: JSON ×7 ≈ tahmini RAM</span>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-6 space-y-4">
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

        {projects.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <div className="animate-spin w-8 h-8 border-2 border-slate-700 border-t-violet-500 rounded-full mx-auto mb-4" />
            <p>Projeler yükleniyor…</p>
          </div>
        )}

        {isFiltering && visibleFileKeys.size === 0 && projects.length > 0 && (
          <div className="text-center py-12 text-slate-500 text-sm">
            Filtre kriterlerine uyan dosya bulunamadı.
          </div>
        )}
      </main>
    </div>
  )
}
