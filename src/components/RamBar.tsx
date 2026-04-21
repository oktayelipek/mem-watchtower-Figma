interface RamBarProps {
  ratio: number
  color: string
  label: string
  showScale?: boolean
}

export function RamBar({ ratio, color, label, showScale }: RamBarProps) {
  const pct = Math.round(ratio * 100)

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden min-w-[80px]">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-mono whitespace-nowrap" style={{ color }}>
        {label}
      </span>
      {showScale && (
        <span className="text-xs text-slate-500 whitespace-nowrap">{pct}%</span>
      )}
    </div>
  )
}
