import type { Anime } from './types'

const PREFIX = 'lazymal-cache-v3:'
const TTL_MS = 1000 * 60 * 60 * 3 // 3 hours

interface CacheEntry {
  ts: number
  data: Anime[]
}

// Each media/season gets its own localStorage slot so anime and manga can both
// stay cached at once (toggling reads the right one instantly).
const slot = (key: string) => PREFIX + key

/** Read the cached list for a key (e.g. "manga", "anime-now"), or null. */
export function readCache(key: string): { data: Anime[]; fresh: boolean } | null {
  try {
    const raw = localStorage.getItem(slot(key))
    if (!raw) return null
    const entry = JSON.parse(raw) as CacheEntry
    if (!Array.isArray(entry.data) || entry.data.length === 0) return null
    return { data: entry.data, fresh: Date.now() - entry.ts < TTL_MS }
  } catch {
    return null
  }
}

export function writeCache(key: string, data: Anime[]): void {
  try {
    if (data.length === 0) return
    const entry: CacheEntry = { ts: Date.now(), data }
    localStorage.setItem(slot(key), JSON.stringify(entry))
  } catch {
    /* quota / disabled storage — ignore */
  }
}

// --- single-item (detail) cache -------------------------------------------
const DETAIL_TTL_MS = 1000 * 60 * 60 * 24 // 1 day; rank/popularity change slowly

export function readDetail(key: string): Anime | null {
  try {
    const raw = localStorage.getItem(slot('d:' + key))
    if (!raw) return null
    const e = JSON.parse(raw) as { ts: number; data: Anime }
    if (Date.now() - e.ts > DETAIL_TTL_MS) return null
    return e.data
  } catch {
    return null
  }
}

export function writeDetail(key: string, data: Anime): void {
  try {
    localStorage.setItem(slot('d:' + key), JSON.stringify({ ts: Date.now(), data }))
  } catch {
    /* ignore */
  }
}
