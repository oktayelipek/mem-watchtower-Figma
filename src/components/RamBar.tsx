interface RamBarProps {
  ratio: number
  color: string
}

export function RamBar({ ratio, color }: RamBarProps) {
  const pct = Math.round(ratio * 100)

  return (
    <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden min-w-0">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: color }}
      />
    </div>
  )
}
