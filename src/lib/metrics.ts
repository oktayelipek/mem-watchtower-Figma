import type { FastMetrics, DeepMetrics } from '../types/figma'

export const RAM_LIMIT_MB = 2048

export function getRamPressure(_fast: FastMetrics | null, deep: DeepMetrics | null): number {
  if (deep) {
    return Math.min(deep.estimatedRamMB / RAM_LIMIT_MB, 1)
  }
  return 0
}

export function getRamColor(pressure: number): string {
  if (pressure >= 0.7) return '#ef4444'  // red
  if (pressure >= 0.4) return '#f59e0b'  // amber
  return '#22c55e'                        // green
}

export function getRamLabel(fast: FastMetrics | null, deep: DeepMetrics | null): string {
  if (deep) {
    const mb = deep.estimatedRamMB
    return mb >= 1024
      ? `~${(mb / 1024).toFixed(1)} GB est.`
      : `~${Math.round(mb)} MB est.`
  }
  if (fast) return `score ${fast.complexityScore}`
  return '—'
}

export function getComplexityBar(fast: FastMetrics, allScores: number[]): number {
  const max = Math.max(...allScores, 1)
  return fast.complexityScore / max
}

export function formatBytes(mb: number): string {
  return mb >= 1024
    ? `${(mb / 1024).toFixed(2)} GB`
    : `${mb.toFixed(1)} MB`
}

export type RiskLevel = 'high' | 'medium' | 'low' | 'unscanned'

export function getRiskLevel(fast: import('../types/figma').FastMetrics | null, deep: import('../types/figma').DeepMetrics | null): RiskLevel {
  if (!deep) return 'unscanned'
  const p = getRamPressure(fast, deep)
  if (p >= 0.7) return 'high'
  if (p >= 0.4) return 'medium'
  return 'low'
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
