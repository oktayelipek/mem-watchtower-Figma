import type { ProjectData } from '../types/figma'
import { getRiskLevel, getRamPressure, getRamColor } from '../lib/metrics'

function projectLabel(name: string) {
  return name.replace(/^_/, '').replace(/\s*\[\d+\s*\w*\]/, '').trim()
}

function getProjectStats(project: ProjectData) {
  const { files } = project
  const scanned = files.filter((f) => f.deepMetrics)

  const libs = files.filter((f) => f.isLibrary).length
  const high = scanned.filter((f) => getRiskLevel(f.fastMetrics, f.deepMetrics) === 'high').length
  const medium = scanned.filter((f) => getRiskLevel(f.fastMetrics, f.deepMetrics) === 'medium').length
  const low = scanned.filter((f) => getRiskLevel(f.fastMetrics, f.deepMetrics) === 'low').length
  const unscanned = files.length - scanned.length

  const maxPressure = scanned.length > 0
    ? Math.max(...scanned.map((f) => getRamPressure(f.fastMetrics, f.deepMetrics)))
    : null

  return { high, medium, low, unscanned, libs, maxPressure, scannedCount: scanned.length, totalCount: files.length }
}

interface ProjectCardsProps {
  projects: ProjectData[]
  activeProjectId: string
  onProjectFilter: (id: string) => void
  onScanProject: (projectId: string) => void
}

export function ProjectCards({ projects, activeProjectId, onProjectFilter, onScanProject }: ProjectCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {projects.map((project) => {
        const stats = getProjectStats(project)
        const isActive = activeProjectId === project.projectId
        const scoreColor = stats.maxPressure !== null ? getRamColor(stats.maxPressure) : '#475569'
        const scorePct = stats.maxPressure !== null ? Math.round(stats.maxPressure * 100) : null
        const isScanning = project.files.some((f) => f.loadingDeep)

        return (
          <div
            key={project.projectId}
            className={`relative p-4 rounded-xl border transition-all cursor-pointer ${
              isActive
                ? 'border-violet-500/60 bg-violet-900/20 ring-1 ring-violet-500/20'
                : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/70'
            }`}
            onClick={() => onProjectFilter(isActive ? '' : project.projectId)}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-slate-200 leading-snug">
                {projectLabel(project.projectName)}
              </span>
              {scorePct !== null && (
                <span className="text-sm font-bold font-mono flex-shrink-0" style={{ color: scoreColor }}>
                  {scorePct}%
                </span>
              )}
            </div>

            <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-3">
              {isScanning ? (
                <div className="h-full w-full bg-violet-500/40 animate-pulse rounded-full" />
              ) : scorePct !== null ? (
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.max(scorePct, 2)}%`, backgroundColor: scoreColor }}
                />
              ) : (
                <div className="h-full w-full bg-slate-800" />
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
{stats.high > 0 && <RiskChip count={stats.high} dot="bg-red-500" text="text-red-400" />}
                {stats.medium > 0 && <RiskChip count={stats.medium} dot="bg-amber-500" text="text-amber-400" />}
                {stats.low > 0 && <RiskChip count={stats.low} dot="bg-green-500" text="text-green-400" />}
                {stats.unscanned > 0 && <RiskChip count={stats.unscanned} dot="bg-slate-600" text="text-slate-500" />}
                {stats.libs > 0 && (
                  <span title={`${stats.libs} published library`} className="text-xs text-violet-500 font-semibold">
                    {stats.libs} lib
                  </span>
                )}
                {stats.scannedCount === 0 && !isScanning && (
                  <span className="text-xs text-slate-600">Not scanned</span>
                )}
                {isScanning && (
                  <span className="text-xs text-violet-400">Scanning…</span>
                )}
              </div>

              {stats.unscanned > 0 && !isScanning && (
                <button
                  onClick={(e) => { e.stopPropagation(); onScanProject(project.projectId) }}
                  className="flex-shrink-0 text-xs px-2 py-0.5 rounded border border-slate-700 text-slate-500 hover:border-violet-500 hover:text-violet-400 transition-colors"
                >
                  Scan
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RiskChip({ count, dot, text }: { count: number; dot: string; text: string }) {
  return (
    <span className={`flex items-center gap-1 text-xs ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {count}
    </span>
  )
}

