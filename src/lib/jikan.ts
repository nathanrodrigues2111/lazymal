import type { Anime, Season, SeasonResponse } from './types'

const BASE = 'https://api.jikan.moe/v4'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Fetch wrapper with backoff retries. Jikan proxies MyAnimeList, so it both
 * rate-limits (429, ~3 req/s) and intermittently returns 5xx when MAL's
 * upstream is slow/unavailable. Both are transient, so we retry a few times
 * with escalating backoff before surfacing an error to the UI.
 */
async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const MAX = 6
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
 * Fetch the ENTIRE current season by walking Jikan's pages. Titles are streamed
 * back via `onPage` as each page lands (so the grid fills progressively), and
 * the full de-duplicated list is returned. A delay between pages keeps us under
 * Jikan's ~3 req/s rate limit.
 */
export async function fetchNow(
  signal?: AbortSignal,
  onPage?: (soFar: Anime[]) => void,
): Promise<Anime[]> {
  const all: Anime[] = []
  const seen = new Set<number>()
  let page = 1
  let hasNext = true

  while (hasNext && page <= MAX_PAGES) {
    const res = await get<SeasonResponse>(
      `/seasons/now?sfw=true&page=${page}`,
      signal,
    )
    for (const a of res.data) {
      if (!seen.has(a.mal_id)) {
        seen.add(a.mal_id)
        all.push(a)
      }
    }
    onPage?.(all.slice())
    hasNext = res.pagination.has_next_page
    page += 1
    if (hasNext) await sleep(700)
  }
  return all
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
