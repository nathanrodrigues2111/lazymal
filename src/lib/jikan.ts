import type { Anime, Season, SeasonResponse } from './types'
import { readDetail, writeDetail } from './cache'

// Our self-hosted LazyMAL API worker is primary; the public Jikan API is the
// backup if the worker is ever unreachable. Override the primary via
// VITE_API_BASE.
const PRIMARY =
  import.meta.env.VITE_API_BASE ||
  'https://lazymal-api.lazyneilmedia.workers.dev'
const FALLBACK = 'https://api.jikan.moe/v4'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Fetch one base with backoff retries. Sources both rate-limit (429) and
 * intermittently 5xx when MAL's upstream is slow, so we retry a few times with
 * escalating backoff before giving up on this base.
 */
async function fetchBase<T>(
  base: string,
  path: string,
  signal: AbortSignal | undefined,
  maxAttempts: number,
): Promise<T> {
  let lastStatus = 0
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let res: Response
    try {
      res = await fetch(`${base}${path}`, { signal })
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      if (attempt < maxAttempts - 1) {
        await sleep(600 * (attempt + 1))
        continue
      }
      throw err
    }
    if (res.ok) return (await res.json()) as T
    lastStatus = res.status
    // 501 = our worker has no MAL key for this endpoint → don't retry, fall back
    // to Jikan immediately. 429/other-5xx are transient and worth retrying.
    const retryable = res.status === 429 || (res.status >= 500 && res.status !== 501)
    if (retryable && attempt < maxAttempts - 1) {
      await sleep(res.status === 429 ? 1200 : 700 * (attempt + 1))
      continue
    }
    throw new Error(`${base} ${res.status} on ${path}`)
  }
  throw new Error(`${base} unavailable (${lastStatus}) on ${path}`)
}

/** Try our worker first; if it fails entirely, fall back to Jikan. */
async function get<T>(
  path: string,
  signal?: AbortSignal,
  maxAttempts = 6,
): Promise<T> {
  try {
    return await fetchBase<T>(PRIMARY, path, signal, maxAttempts)
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    // Worker down/unreachable — try the Jikan backup.
    return await fetchBase<T>(FALLBACK, path, signal, Math.min(maxAttempts, 4))
  }
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
      res = await get<SeasonResponse>(
        `/seasons/now?sfw=true&page=${page}`,
        signal,
        3,
      )
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
  const res = await get<SeasonResponse>('/seasons/now?sfw=true', signal, 6)
  return dedupe(res.data)
}

/**
 * Full details for one title. Our scraped list lacks fields like rank &
 * popularity, so the detail view enriches from here — the worker has no key so
 * get() falls back to Jikan's /anime|manga/{id}, which returns everything.
 */
export async function fetchDetails(
  id: number,
  media: 'anime' | 'manga',
  signal?: AbortSignal,
): Promise<Anime | null> {
  const key = `${media}-${id}`
  const cached = readDetail(key)
  const fresh = get<{ data: Anime }>(`/${media}/${id}`, signal, 3)
    .then((res) => {
      writeDetail(key, res.data)
      return res.data
    })
    .catch(() => null)
  // Instant from cache when available; otherwise wait for the network.
  return cached ?? (await fresh)
}

/**
 * Live search for titles not in the current list. Hits the worker's search
 * endpoint (falls back to Jikan). Returns up to ~25 matches.
 */
export async function searchTitles(
  q: string,
  media: 'anime' | 'manga',
  signal?: AbortSignal,
): Promise<Anime[]> {
  const query = q.trim()
  if (!query) return []
  try {
    const res = await get<SeasonResponse>(
      `/${media}?q=${encodeURIComponent(query)}&limit=24`,
      signal,
      3,
    )
    return dedupe(res.data)
  } catch {
    return []
  }
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
 * Top manga (manga has no "season"). Pages through /top/manga so the whole
 * ranking loads, keeping partial results if a later page fails.
 */
export async function fetchManga(signal?: AbortSignal): Promise<Anime[]> {
  const all: Anime[] = []
  const seen = new Set<number>()
  let page = 1
  let hasNext = true

  while (hasNext && page <= MAX_PAGES) {
    let res: SeasonResponse
    try {
      res = await get<SeasonResponse>(`/top/manga?page=${page}`, signal, 3)
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

  const res = await get<SeasonResponse>('/top/manga', signal, 6)
  return dedupe(res.data)
}
