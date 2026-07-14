import type { Anime, SeasonResponse } from './types'

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
export async function fetchNow(signal?: AbortSignal): Promise<Anime[]> {
  const res = await get<SeasonResponse>('/seasons/now', signal)
  // MAL occasionally lists the same title twice (e.g. dual entries); de-dupe
  // by mal_id so React keys stay unique.
  const seen = new Set<number>()
  return res.data.filter((a) => !seen.has(a.mal_id) && seen.add(a.mal_id))
}
