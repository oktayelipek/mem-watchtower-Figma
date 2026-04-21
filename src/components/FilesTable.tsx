import { useState } from 'react'
import type { ProjectData } from '../types/figma'
import {
  getRamPressure, getRamColor, getComplexityBar,
  formatDate, RAM_LIMIT_MB,
} from '../lib/metrics'
import { RamBar } from './RamBar'
import type { SortKey } from './SortControls'

interface FlatFile {
  projectId: string
  projectName: string
  key: string
  name: string
  last_modified: string
  isLibrary: boolean
  branches: ProjectData['files'][number]['branches']
  fastMetrics: ProjectData['files'][number]['fastMetrics']
  deepMetrics: ProjectData['files'][number]['deepMetrics']
  loadingFast: boolean
  loadingDeep: boolean
  errorFast: string | null
  errorDeep: string | null
}

interface FilesTableProps {
  projects: ProjectData[]
  sort: SortKey
  visibleFileKeys?: Set<string>
  onDeepScanAll: () => void
}

export function FilesTable({ projects, sort, visibleFileKeys, onDeepScanAll }: FilesTableProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  function toggleExpand(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const allFiles: FlatFile[] = projects.flatMap((p) =>
    p.files.map((f) => ({ ...f, projectId: p.projectId, projectName: p.projectName }))
  )

  const allComplexityScores = allFiles
    .map((f) => f.fastMetrics?.complexityScore ?? 0)
    .filter((s) => s > 0)

  const filtered = visibleFileKeys
    ? allFiles.filter((f) => visibleFileKeys.has(f.key))
    : allFiles

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name)
    if (sort === 'ram') {
      const ra = a.deepMetrics?.estimatedRamMB ?? 0
      const rb = b.deepMetrics?.estimatedRamMB ?? 0
      return rb - ra
    }
    const ca = a.fastMetrics?.complexityScore ?? 0
    const cb = b.fastMetrics?.complexityScore ?? 0
    return cb - ca
  })

  const hasAnyScanning = allFiles.some((f) => f.loadingDeep)
  const unscannedCount = allFiles.filter((f) => !f.deepMetrics).length

  return (
    <div className="rounded-xl border border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
        <span className="text-xs text-slate-500">
          {sorted.length} {sorted.length === 1 ? 'file' : 'files'}
          {unscannedCount > 0 && ` · ${unscannedCount} unscanned`}
        </span>
        <button
          onClick={onDeepScanAll}
          disabled={hasAnyScanning || unscannedCount === 0}
          className="text-xs px-3 py-1 rounded-md bg-violet-900/40 border border-violet-700/40 text-violet-400 hover:bg-violet-800/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {hasAnyScanning ? 'Scanning…' : 'Scan all'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-[168px]" />
            <col className="w-[80px]" />
            <col className="w-[140px]" />
            <col className="w-[64px]" />
            <col className="w-[90px]" />
            <col className="w-[96px]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/60">
              <Th>File</Th>
              <Th>Project</Th>
              <Th>RAM Pressure</Th>
              <Th right>Score</Th>
              <Th right>Pg / Fr</Th>
              <Th right>Modified</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {sorted.map((f) => (
              <FileRow
                key={f.key}
                file={f}
                allComplexityScores={allComplexityScores}
                expanded={expandedKeys.has(f.key)}
                onToggleExpand={() => toggleExpand(f.key)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BranchPanel({ branches, parentRamMB }: {
  branches: FlatFile['branches']
  parentRamMB: number | null
}) {
  return (
    <div className="ml-6 rounded-lg border border-slate-800 bg-slate-950/60 overflow-hidden">
      {branches.map((b, i) => {
        const ram = b.estimatedRamMB
        const isHeavier = ram !== null && parentRamMB !== null && ram > parentRamMB
        const delta = ram !== null && parentRamMB !== null ? ram - parentRamMB : null
        const ramLabel = ram !== null
          ? ram >= 1024 ? `${(ram / 1024).toFixed(1)} GB` : `${Math.round(ram)} MB`
          : '—'
        const deltaLabel = delta !== null
          ? delta > 0
            ? `+${Math.round(delta)} MB`
            : `${Math.round(delta)} MB`
          : null
        const staleBranch = b.lastModified
          ? (Date.now() - new Date(b.lastModified).getTime()) > 60 * 86_400_000
          : false

        return (
          <div key={b.branchKey} className={`flex items-center gap-3 px-3 py-2 text-xs ${i > 0 ? 'border-t border-slate-800/60' : ''}`}>
            <span className="text-slate-600 flex-shrink-0">⎇</span>
            <span className={`flex-1 truncate font-medium ${isHeavier ? 'text-amber-300' : 'text-slate-300'}`}>
              {b.name}
            </span>
            {staleBranch && (
              <span title="No changes in 60+ days" className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-500">
                stale
              </span>
            )}
            {b.lastModified && (
              <span className="text-slate-600 flex-shrink-0">{formatDate(b.lastModified)}</span>
            )}
            <span className={`font-mono flex-shrink-0 ${isHeavier ? 'text-amber-400' : 'text-slate-400'}`}>
              {ramLabel}
            </span>
            {deltaLabel && (
              <span className={`font-mono text-[10px] flex-shrink-0 ${delta! > 0 ? 'text-amber-500' : 'text-green-500'}`}>
                {deltaLabel}
              </span>
            )}
            {isHeavier && (
              <span title="Heavier than main — merging may increase RAM" className="flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ScanAge({ fetchedAt }: { fetchedAt: number | null }) {
  if (!fetchedAt) return null
  const diffMs = Date.now() - fetchedAt
  const diffDays = Math.floor(diffMs / 86_400_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const label = diffDays >= 1 ? `${diffDays}d` : diffHours >= 1 ? `${diffHours}h` : '<1h'
  const stale = diffDays >= 7
  const title = new Date(fetchedAt).toLocaleString('tr-TR')
  return (
    <span title={`Scanned ${title}`} className={`text-[10px] font-mono ${stale ? 'text-amber-400' : 'text-slate-400'}`}>
      {label}
    </span>
  )
}

function Th({ children, right, className = '' }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap ${right ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </th>
  )
}

function FileRow({ file: f, allComplexityScores, expanded, onToggleExpand }: {
  file: FlatFile
  allComplexityScores: number[]
  expanded: boolean
  onToggleExpand: () => void
}) {
  let barRatio = 0
  let barColor = '#64748b'

  const isExceeded = !!f.deepMetrics && f.deepMetrics.estimatedRamMB > RAM_LIMIT_MB
  const THRESHOLD_MB = RAM_LIMIT_MB * 0.7
  const isOverThreshold = !!f.deepMetrics && f.deepMetrics.estimatedRamMB >= THRESHOLD_MB && !isExceeded

  const heavyBranch = f.branches.find(
    (b) => b.estimatedRamMB !== null && b.estimatedRamMB > (f.deepMetrics?.estimatedRamMB ?? 0)
  )

  if (f.deepMetrics) {
    barRatio = getRamPressure(f.fastMetrics, f.deepMetrics)
    barColor = getRamColor(barRatio)
  } else if (f.fastMetrics && allComplexityScores.length > 0) {
    barRatio = getComplexityBar(f.fastMetrics, allComplexityScores)
    barColor = getRamColor(barRatio * 0.6)
  }

  return (
    <>
    <tr className={`transition-colors ${isExceeded ? 'bg-red-950/40 hover:bg-red-950/50' : isOverThreshold ? 'bg-red-950/20 hover:bg-red-950/30' : 'hover:bg-white/[0.02]'}`}>
      <td className="px-4 py-3 overflow-hidden">
        <div className="flex items-center gap-2">
          {isExceeded && (
            <span title="Exceeds 2 GB limit" className="flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-red-300" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
            </span>
          )}
          {isOverThreshold && (
            <span title={`Estimated RAM ≥ ${Math.round(THRESHOLD_MB)} MB — approaching 2 GB limit`} className="flex-shrink-0">
              <svg className="w-3.5 h-3.5 text-red-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </span>
          )}
          <a
            href={`https://www.figma.com/file/${f.key}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-200 hover:text-violet-400 transition-colors font-medium truncate"
            title={f.name}
          >
            {f.name}
          </a>
          {f.isLibrary && (
            <span title="Published component library" className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-violet-900/50 border border-violet-700/50 text-violet-400">
              lib
            </span>
          )}
          {f.branches.length > 0 && (
            <button
              onClick={(e) => { e.preventDefault(); onToggleExpand() }}
              title={`${f.branches.length} branch${f.branches.length > 1 ? 'es' : ''}`}
              className={`flex-shrink-0 flex items-center gap-0.5 text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                expanded
                  ? 'bg-slate-700 border-slate-500 text-slate-200'
                  : heavyBranch
                    ? 'bg-amber-950/40 border-amber-700/50 text-amber-400'
                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              ⎇ {f.branches.length}
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3 overflow-hidden">
        <span className="text-slate-500 truncate block" title={f.projectName}>
          {f.projectName}
        </span>
      </td>
      <td className="px-4 py-3">
        {f.loadingFast ? (
          <div className="h-1 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-1/3 bg-slate-600 animate-pulse rounded-full" />
          </div>
        ) : f.errorFast ? (
          <span className="text-xs text-red-400">Error</span>
        ) : (
          <div className="flex items-center gap-2">
            <RamBar ratio={barRatio} color={barColor} />
            {f.deepMetrics ? (
              <span className="flex items-center gap-1.5 flex-shrink-0">
                <span className={`text-xs font-mono ${isExceeded ? 'text-red-300 font-semibold' : 'text-slate-400'}`}>
                  {f.deepMetrics.estimatedRamMB >= 1024
                    ? `${(f.deepMetrics.estimatedRamMB / 1024).toFixed(1)} GB`
                    : `${Math.round(f.deepMetrics.estimatedRamMB)} MB`}
                </span>
                <ScanAge fetchedAt={f.deepMetrics.fetchedAt} />
              </span>
            ) : (
              <span className="text-xs font-mono text-slate-400 flex-shrink-0">—</span>
            )}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
        {f.deepMetrics
          ? <span style={{ color: barColor }}>{Math.round(barRatio * 100)}%</span>
          : <span className="text-slate-700">—</span>}
      </td>
      <td className="px-4 py-3 text-right font-mono text-slate-400">
        {f.fastMetrics
          ? <span>{f.fastMetrics.pageCount}<span className="text-slate-600"> / </span>{f.fastMetrics.frameCount}</span>
          : <span className="text-slate-700">—</span>}
      </td>
      <td className="px-4 py-3 text-right text-slate-500">
        {formatDate(f.last_modified)}
      </td>
    </tr>
    {expanded && f.branches.length > 0 && (
      <tr>
        <td colSpan={6} className="px-4 pb-3 pt-0">
          <BranchPanel branches={f.branches} parentRamMB={f.deepMetrics?.estimatedRamMB ?? null} />
        </td>
      </tr>
    )}
    </>
  )
}
