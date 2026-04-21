import type { ProjectData } from '../types/figma'
import { getRiskLevel } from '../lib/metrics'
import { BranchRow } from './BranchRow'

interface ProjectAccordionProps {
  data: ProjectData
  onToggle: () => void
  onDeepScanFile: (fileKey: string) => void
  onDeepScanAll: () => void
  visibleFileKeys?: Set<string>
}

export function FileAccordion({ data, onToggle, onDeepScanFile, onDeepScanAll, visibleFileKeys }: ProjectAccordionProps) {
  const { projectName, files, expanded } = data
  const displayFiles = visibleFileKeys ? files.filter((f) => visibleFileKeys.has(f.key)) : files
  const allComplexityScores = files.map((f) => f.fastMetrics?.complexityScore ?? 0).filter((s) => s > 0)
  const hasAnyDeepScanning = files.some((f) => f.loadingDeep)
  const loadedCount = files.filter((f) => !f.loadingFast).length

  const scanned = files.filter((f) => f.deepMetrics)
  const highCount = scanned.filter((f) => getRiskLevel(f.fastMetrics, f.deepMetrics) === 'high').length
  const mediumCount = scanned.filter((f) => getRiskLevel(f.fastMetrics, f.deepMetrics) === 'medium').length

  if (visibleFileKeys && displayFiles.length === 0) return null

  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 bg-slate-900 hover:bg-slate-800/60 transition-colors text-left"
      >
        <ChevronIcon expanded={expanded} />

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-100 truncate">{projectName}</div>
          <div className="text-xs text-slate-500">
            {files.length} dosya
            {loadedCount < files.length && ` · ${files.length - loadedCount} yükleniyor`}
          </div>
        </div>

        {(highCount > 0 || mediumCount > 0) && (
          <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {highCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 border border-red-700/40 text-red-400 font-medium">
                {highCount} yüksek
              </span>
            )}
            {mediumCount > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/40 border border-amber-700/40 text-amber-400 font-medium">
                {mediumCount} orta
              </span>
            )}
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-800 bg-slate-950/40">
          {displayFiles.length === 0 && (
            <div className="px-5 py-4 text-sm text-slate-500">Dosya bulunamadı.</div>
          )}

          {displayFiles.length > 0 && (
            <>
              <div className="flex items-center gap-4 px-4 py-2 border-b border-slate-800/60">
                <div className="w-2 h-2 flex-shrink-0" />
                <div className="flex-shrink-0 w-52 text-xs text-slate-600 font-medium uppercase tracking-wide">Dosya</div>
                <div className="flex-1 text-xs text-slate-600 font-medium uppercase tracking-wide">RAM Yükü</div>
                <div className="flex-shrink-0 text-xs text-slate-600 font-medium uppercase tracking-wide">Metrikler</div>
                <button
                  onClick={onDeepScanAll}
                  disabled={hasAnyDeepScanning}
                  className="flex-shrink-0 text-xs px-3 py-1 rounded-md bg-violet-900/40 border border-violet-700/40 text-violet-400 hover:bg-violet-800/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Tümünü Tara
                </button>
              </div>

              <div className="divide-y divide-slate-800/40">
                {displayFiles.map((f) => (
                  <BranchRow
                    key={f.key}
                    data={f}
                    allComplexityScores={allComplexityScores}
                    onDeepScan={() => onDeepScanFile(f.key)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 flex-shrink-0 text-slate-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}
