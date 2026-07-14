import type { Anime, Season, SeasonResponse } from './types'

// Point this at a self-hosted LazyMAL API worker via VITE_API_BASE (see /api),
// otherwise fall back to the public Jikan API.
const BASE = import.meta.env.VITE_API_BASE || 'https://api.jikan.moe/v4'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Fetch wrapper with backoff retries. Jikan proxies MyAnimeList, so it both
 * rate-limits (429, ~3 req/s) and intermittently returns 5xx when MAL's
 * upstream is slow/unavailable. Both are transient, so we retry a few times
 * with escalating backoff before surfacing an error to the UI.
 */
async function get<T>(
  path: string,
  signal?: AbortSignal,
  maxAttempts = 6,
): Promise<T> {
  const MAX = maxAttempts
  let lastStatus = 0
  for (let attempt = 0; attempt < MAX; attempt++) {
    let res: Response
    try {
      res = await fetch(`${BASE}${path}`, { signal })
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      // Network hiccup — back off and retry.
      if (attempt < MAX - 1) {
        await sleep(600 * (attempt + 1))
        continue
      }
      throw err
    }
    if (res.ok) return (await res.json()) as T
    lastStatus = res.status
    // 429 = rate limited, 5xx = MAL upstream flaky — both worth retrying.
    if ((res.status === 429 || res.status >= 500) && attempt < MAX - 1) {
      await sleep(res.status === 429 ? 1200 : 700 * (attempt + 1))
      continue
    }
    throw new Error(`Jikan ${res.status} on ${path}`)
  }
  throw new Error(`Jikan unavailable (${lastStatus}) on ${path}`)
}

/**
 * Fetch the current season in a single request — one simple query, no paging.
 * Returns the season's anime list (retries transient 429/5xx internally).
 */
// MAL occasionally lists the same title twice (e.g. dual entries); de-dupe by
// mal_id so React keys stay unique.
function dedupe(list: Anime[]): Anime[] {
  const seen = new Set<number>()
  return list.filter((a) => !seen.has(a.mal_id) && seen.add(a.mal_id))
}

// Safety cap — no real season comes near this many pages (25 titles each).
const MAX_PAGES = 15

/**
 * Fetch the ENTIRE current season by paging through `/seasons/now?page=N` so
 * everything shows up. If a page fails we stop and keep what we have; if even
 * the first page fails, we fall back to the bare `/seasons/now` endpoint, which
 * is the most reliable Jikan cache key.
 */
export async function fetchNow(signal?: AbortSignal): Promise<Anime[]> {
  const all: Anime[] = []
  const seen = new Set<number>()
  let page = 1
  let hasNext = true

  while (hasNext && page <= MAX_PAGES) {
    let res: SeasonResponse
    try {
      // Fewer retries per page so a flaky page fails fast instead of hanging.
      res = await get<SeasonResponse>(`/seasons/now?page=${page}`, signal, 3)
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      break // stop paging; use whatever we've gathered so far
    }
    for (const a of res.data) {
      if (!seen.has(a.mal_id)) {
        seen.add(a.mal_id)
        all.push(a)
      }
    }
    hasNext = res.pagination.has_next_page
    page += 1
    if (hasNext) await sleep(600)
  }

  if (all.length > 0) return dedupe(all)

  // Fallback: the reliable bare endpoint (more retries).
  const res = await get<SeasonResponse>('/seasons/now', signal, 6)
  return dedupe(res.data)
}

/** A specific season (single request, like fetchNow). */
export async function fetchSeason(
  { year, season }: Season,
  signal?: AbortSignal,
): Promise<Anime[]> {
  const res = await get<SeasonResponse>(
    `/seasons/${year}/${season}?sfw=true`,
    signal,
  )
  return dedupe(res.data)
}

/**
 * Top manga (manga has no "season"). Pages through /top/manga, keeping partial
 * results on failure and falling back to the first page.
 */
export async function fetchManga(signal?: AbortSignal): Promise<Anime[]> {
  const all: Anime[] = []
  const seen = new Set<number>()
  let page = 1
  let hasNext = true

  while (hasNext && page <= MAX_PAGES) {
    let res: SeasonResponse
    try {
      // Primary: currently-publishing manga.
      res = await get<SeasonResponse>(
        `/top/manga?filter=publishing&page=${page}`,
        signal,
        3,
      )
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      break
    }
    for (const a of res.data) {
      if (!seen.has(a.mal_id)) {
        seen.add(a.mal_id)
        all.push(a)
      }
    }
    hasNext = res.pagination.has_next_page
    page += 1
    if (hasNext) await sleep(600)
  }

  if (all.length > 0) return dedupe(all)

  // Backup: bare /top/manga (the reliable cache key).
  const res = await get<SeasonResponse>('/top/manga', signal, 6)
  return dedupe(res.data)
}
