export type SortKey = 'complexity' | 'ram' | 'name'
export type RiskFilter = 'all' | 'high' | 'medium' | 'low' | 'unscanned'

interface SortControlsProps {
  sort: SortKey
  onSort: (s: SortKey) => void
  riskFilter: RiskFilter
  onRiskFilter: (f: RiskFilter) => void
  search: string
  onSearch: (s: string) => void
  totalProjects: number
  totalFiles: number
}

const riskOptions: { key: RiskFilter; label: string; activeClass: string }[] = [
  { key: 'all', label: 'All', activeClass: 'bg-slate-700 border-slate-500 text-slate-200' },
  { key: 'high', label: 'High', activeClass: 'bg-slate-800 text-red-400 border-red-700/60' },
  { key: 'medium', label: 'Medium', activeClass: 'bg-slate-800 text-amber-400 border-amber-700/60' },
  { key: 'low', label: 'Low', activeClass: 'bg-slate-800 text-green-400 border-green-700/60' },
  { key: 'unscanned', label: 'Unscanned', activeClass: 'bg-slate-800 text-slate-400 border-slate-600' },
]

export function SortControls({
  sort, onSort, riskFilter, onRiskFilter, search, onSearch,
  totalProjects, totalFiles,
}: SortControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 whitespace-nowrap">
        <span className="text-slate-300 font-medium">{totalProjects}</span> projects ·{' '}
        <span className="text-slate-300 font-medium">{totalFiles}</span> files
      </span>

      <div className="relative flex-1 min-w-[160px] max-w-xs">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search files…"
          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
        />
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        {riskOptions.map((opt) => (
          <button
            key={opt.key}
            onClick={() => onRiskFilter(opt.key)}
            className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
              riskFilter === opt.key
                ? opt.activeClass
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-400'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <select
        value={sort}
        onChange={(e) => onSort(e.target.value as SortKey)}
        className="text-xs px-2.5 py-1.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 focus:outline-none focus:border-violet-500 cursor-pointer"
      >
        <option value="ram">Sort: RAM ↓</option>
        <option value="complexity">Sort: Complexity</option>
        <option value="name">Sort: Name</option>
      </select>
    </div>
  )
}
