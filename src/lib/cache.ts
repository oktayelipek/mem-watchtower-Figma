const CACHE_KEY = 'wt_cache_v2'
const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

interface RawFile {
  key: string
  name: string
  thumbnail_url: string
  last_modified: string
}

interface CacheEntry {
  timestamp: number
  projects: Array<{ id: string; name: string }>
  filesByProject: Record<string, RawFile[]>
}

export function saveCache(
  projects: Array<{ id: string; name: string }>,
  filesByProject: Record<string, RawFile[]>,
) {
  try {
    const entry: CacheEntry = { timestamp: Date.now(), projects, filesByProject }
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry))
  } catch {
    // quota exceeded or private mode — ignore
  }
}

export function loadCache(): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY)
      return null
    }
    return entry
  } catch {
    return null
  }
}

export function clearCache() {
  localStorage.removeItem(CACHE_KEY)
}
