import type { ProjectData } from '../types/figma'
import { getRiskLevel } from '../lib/metrics'
import type { RiskFilter } from './SortControls'

interface RiskSummaryProps {
  projects: ProjectData[]
  onFilter: (f: RiskFilter) => void
  activeFilter: RiskFilter
}

export function RiskSummary({ projects, onFilter, activeFilter }: RiskSummaryProps) {
  const files = projects.flatMap((p) => p.files)
  const scanned = files.filter((f) => f.deepMetrics)

  if (scanned.length === 0) return null

  const high = scanned.filter((f) => getRiskLevel(f.fastMetrics, f.deepMetrics) === 'high').length
  const medium = scanned.filter((f) => getRiskLevel(f.fastMetrics, f.deepMetrics) === 'medium').length
  const low = scanned.filter((f) => getRiskLevel(f.fastMetrics, f.deepMetrics) === 'low').length
  const unscanned = files.length - scanned.length

  const items: { label: string; count: number; filter: RiskFilter; dot: string; text: string; bg: string }[] = [
    { label: 'High risk', count: high, filter: 'high', dot: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-900/20 border-red-700/30 hover:bg-red-900/30' },
    { label: 'Medium risk', count: medium, filter: 'medium', dot: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-900/20 border-amber-700/30 hover:bg-amber-900/30' },
    { label: 'Low risk', count: low, filter: 'low', dot: 'bg-green-500', text: 'text-green-400', bg: 'bg-green-900/20 border-green-700/30 hover:bg-green-900/30' },
    { label: 'Unscanned', count: unscanned, filter: 'unscanned', dot: 'bg-slate-600', text: 'text-slate-400', bg: 'bg-slate-800/40 border-slate-700/30 hover:bg-slate-800/60' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map((item) => (
        <button
          key={item.filter}
          onClick={() => onFilter(activeFilter === item.filter ? 'all' : item.filter)}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors text-left ${item.bg} ${activeFilter === item.filter ? 'ring-1 ring-inset ring-white/10' : ''}`}
        >
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${item.dot}`} />
          <div>
            <div className={`text-lg font-bold leading-none ${item.text}`}>{item.count}</div>
            <div className="text-xs text-slate-500 mt-0.5">{item.label}</div>
          </div>
        </button>
      ))}
    </div>
  )
}
