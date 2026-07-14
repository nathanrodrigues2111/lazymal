import type { Anime } from './types'

const KEY = 'lazymal-season-cache-v1'
const TTL_MS = 1000 * 60 * 60 * 3 // 3 hours

interface CacheEntry {
  key: string
  ts: number
  data: Anime[]
}

/** Read the cached list for a season key (e.g. "now"), or null. */
export function readCache(key: string): { data: Anime[]; fresh: boolean } | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (entry.key !== key || !Array.isArray(entry.data) || entry.data.length === 0)
      return null
    return { data: entry.data, fresh: Date.now() - entry.ts < TTL_MS }
  } catch {
    return null
  }
}

export function writeCache(key: string, data: Anime[]): void {
  try {
    if (data.length === 0) return
    const entry: CacheEntry = { key, ts: Date.now(), data }
    localStorage.setItem(KEY, JSON.stringify(entry))
  } catch {
    /* quota / disabled storage — ignore */
  }
}
