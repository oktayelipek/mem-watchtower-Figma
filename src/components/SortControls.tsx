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
  allExpanded: boolean
  onToggleAll: () => void
}

const sortOptions: { key: SortKey; label: string }[] = [
  { key: 'ram', label: 'RAM (yüksek→düşük)' },
  { key: 'complexity', label: 'Karmaşıklık' },
  { key: 'name', label: 'İsim' },
]

const riskOptions: { key: RiskFilter; label: string; color: string }[] = [
  { key: 'all', label: 'Tümü', color: '' },
  { key: 'high', label: 'Yüksek', color: 'text-red-400 border-red-700/60' },
  { key: 'medium', label: 'Orta', color: 'text-amber-400 border-amber-700/60' },
  { key: 'low', label: 'Düşük', color: 'text-green-400 border-green-700/60' },
  { key: 'unscanned', label: 'Taranmadı', color: 'text-slate-400 border-slate-600' },
]

export function SortControls({
  sort, onSort, riskFilter, onRiskFilter, search, onSearch,
  totalProjects, totalFiles, allExpanded, onToggleAll,
}: SortControlsProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="text-sm text-slate-500">
            <span className="text-slate-300 font-medium">{totalProjects}</span> proje ·{' '}
            <span className="text-slate-300 font-medium">{totalFiles}</span> dosya
          </div>
          <button
            onClick={onToggleAll}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors border border-slate-700 hover:border-slate-500 rounded px-2 py-1"
          >
            {allExpanded ? 'Tümünü Kapat' : 'Tümünü Aç'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Sırala:</span>
          <div className="flex gap-1">
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => onSort(opt.key)}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                  sort === opt.key ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Dosya ara…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-violet-500"
          />
        </div>

        <div className="flex items-center gap-1">
          {riskOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => onRiskFilter(opt.key)}
              className={`text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                riskFilter === opt.key
                  ? opt.key === 'all'
                    ? 'bg-slate-700 border-slate-500 text-slate-200'
                    : `bg-slate-800 ${opt.color}`
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
