import type { FileData } from '../types/figma'
import { getRamPressure, getRamColor, getComplexityBar, formatBytes, formatDate } from '../lib/metrics'
import { RamBar } from './RamBar'

interface BranchRowProps {
  data: FileData
  allComplexityScores: number[]
  onDeepScan: () => void
}

export function BranchRow({ data, allComplexityScores, onDeepScan }: BranchRowProps) {
  const { key, name, last_modified, fastMetrics, deepMetrics, loadingFast, loadingDeep, errorFast, errorDeep } = data
  const figmaUrl = `https://www.figma.com/file/${key}`

  let barRatio = 0
  let barColor = '#64748b'

  if (deepMetrics) {
    barRatio = getRamPressure(fastMetrics, deepMetrics)
    barColor = getRamColor(barRatio)
  } else if (fastMetrics && allComplexityScores.length > 0) {
    barRatio = getComplexityBar(fastMetrics, allComplexityScores)
    barColor = getRamColor(barRatio * 0.6)
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 rounded-lg transition-colors">
      <div className="w-2 h-2 rounded-full flex-shrink-0 bg-slate-600" />

      <div className="flex-shrink-0 w-52 min-w-0">
        <a
          href={figmaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-slate-200 hover:text-violet-400 transition-colors truncate block"
          title={name}
        >
          {name}
        </a>
        <span className="text-xs text-slate-500">{formatDate(last_modified)}</span>
      </div>

      <div className="flex-1 min-w-0">
        {loadingFast ? (
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-1/3 bg-slate-600 animate-pulse rounded-full" />
          </div>
        ) : errorFast ? (
          <span className="text-xs text-red-400" title={errorFast}>Error</span>
        ) : (
          <RamBar ratio={barRatio} color={barColor} />
        )}
      </div>

      {fastMetrics && !loadingFast && (
        <div className="flex gap-2 flex-shrink-0">
          <Chip label={`${fastMetrics.pageCount}p`} title="Pages" />
          <Chip label={`${fastMetrics.frameCount}fr`} title="Frames" />
          {fastMetrics.componentCount > 0 && (
            <Chip label={`${fastMetrics.componentCount}c`} title="Components" />
          )}
        </div>
      )}

      {deepMetrics && (
        <div className="flex-shrink-0 text-xs font-mono text-slate-400 whitespace-nowrap">
          {formatBytes(deepMetrics.jsonSizeMB)} · {deepMetrics.nodeCount.toLocaleString()} nodes
        </div>
      )}

      <button
        onClick={onDeepScan}
        disabled={loadingDeep}
        className="flex-shrink-0 text-xs px-3 py-1 rounded-md border border-slate-700 text-slate-400 hover:border-violet-500 hover:text-violet-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
      >
        {loadingDeep ? 'Scanning…' : deepMetrics ? 'Refresh' : 'Deep scan'}
      </button>

      {errorDeep && (
        <span className="text-xs text-red-400 flex-shrink-0" title={errorDeep}>!</span>
      )}
    </div>
  )
}

function Chip({ label, title }: { label: string; title: string }) {
  return (
    <span title={title} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
      {label}
    </span>
  )
}
