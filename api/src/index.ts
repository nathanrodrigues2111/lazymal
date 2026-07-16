/**
 * LazyMAL API — a minimal, Cloudflare Workers stand-in for the Jikan API
 * (github.com/jikan-me/jikan), which is being discontinued.
 *
 * Two backends, same Jikan-v4 JSON shape:
 *   • scrape  — parses MyAnimeList's public HTML (no key, the resilient default,
 *               same approach as Jikan). Covers the browse endpoints.
 *   • official — MyAnimeList's official API v2 (needs a free Client ID). Opt-in
 *               via ?source=official; also powers search/details/top-anime.
 *
 * Implemented endpoints (a pragmatic, extensible subset of Jikan):
 *   GET /seasons/now                    scrape | official
 *   GET /seasons/{year}/{season}        scrape | official
 *   GET /top/manga                      scrape | official
 *   GET /top/anime                      official
 *   GET /anime?q=…                      official  (search)
 *   GET /manga?q=…                      official  (search)
 *   GET /anime/{id}[/full]              official  (details)
 *   GET /manga/{id}[/full]              official  (details)
 * All list endpoints accept ?page=N and return { data, pagination }.
 */

import {
  animeDetailsOfficial,
  mangaDetailsOfficial,
  searchAnimeOfficial,
  searchMangaOfficial,
  seasonOfficial,
  topAnimeOfficial,
  topMangaOfficial,
} from './official'
import {
  scrapeAdaptedManga,
  scrapeDetail,
  scrapeSearch,
  scrapeSeason,
} from './scrape'
import type { ListResponse } from './shape'

export interface Env {
  MAL_CLIENT_ID?: string
}

// Adult tags to drop when SFW filtering is on (default). Ecchi is intentionally
// kept — only truly adult (Rx) content is removed, matching Jikan's sfw=true.
const ADULT = new Set(['Hentai', 'Erotica'])

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const SEASONS = ['winter', 'spring', 'summer', 'fall']

function json(body: unknown, status = 200, maxAge = 1800): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': status === 200 ? `public, max-age=${maxAge}` : 'no-store',
      ...CORS,
    },
  })
}

function currentSeason(): { year: number; season: string } {
  const d = new Date()
  const m = d.getUTCMonth()
  const season =
    m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'fall'
  return { year: d.getUTCFullYear(), season }
}

/** Thrown when an official-only endpoint is hit without a Client ID. */
class NeedKey extends Error {}
function key(env: Env): string {
  if (!env.MAL_CLIENT_ID) throw new NeedKey()
  return env.MAL_CLIENT_ID
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
    if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

    const url = new URL(req.url)
    // `?fresh=1` forces a re-fetch that bypasses (and then refreshes) the edge
    // cache — used to re-check dub status after a title may have gained a dub.
    const bypass = url.searchParams.has('fresh')
    const cache = caches.default
    // Normalise the cache key so a forced refresh overwrites the shared entry.
    const canonical = new URL(req.url)
    canonical.searchParams.delete('fresh')
    const cacheKey = new Request(canonical.toString(), { method: 'GET' })
    if (!bypass) {
      const hit = await cache.match(cacheKey)
      if (hit) return hit
    }
    const seg = url.pathname.split('/').filter(Boolean)
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1)
    const q = url.searchParams.get('q')?.trim()
    const official = url.searchParams.get('source') === 'official'
    // Show everything by default; ?sfw=true drops adult entries.
    const sfw = url.searchParams.get('sfw') === 'true'
    const clean = (r: ListResponse): ListResponse =>
      sfw
        ? {
            ...r,
            data: r.data.filter(
              (it) =>
                ![...it.genres, ...(it.themes || [])].some((g) =>
                  ADULT.has(g.name),
                ),
            ),
          }
        : r

    let resp: Response
    try {
      // ---- /seasons/... (scrape by default, official on request) ----
      if (seg[0] === 'seasons' && seg[1] === 'now') {
        const { year, season } = currentSeason()
        resp = json(
          clean(
            official
              ? await seasonOfficial(year, season, page, key(env))
              : await scrapeSeason(year, season, page),
          ),
        )
      } else if (
        seg[0] === 'seasons' &&
        /^\d{4}$/.test(seg[1] || '') &&
        SEASONS.includes(seg[2])
      ) {
        const year = parseInt(seg[1], 10)
        resp = json(
          clean(
            official
              ? await seasonOfficial(year, seg[2], page, key(env))
              : await scrapeSeason(year, seg[2], page),
          ),
        )
      }
      // ---- /top/... ----
      else if (seg[0] === 'top' && seg[1] === 'manga') {
        // Official API (genres + rank + popularity + pagination) when a Client
        // ID is set; otherwise scrape the airing-adapted list, which still has
        // genres/score/members (unlike the bare top-manga ranking page).
        resp = json(
          clean(
            official || env.MAL_CLIENT_ID
              ? await topMangaOfficial(page, key(env))
              : await scrapeAdaptedManga(page),
          ),
        )
      } else if (seg[0] === 'top' && seg[1] === 'anime') {
        resp = json(clean(await topAnimeOfficial(page, key(env))))
      }
      // ---- search: /anime?q= , /manga?q= (scrape, or official with a key) ----
      else if ((seg[0] === 'anime' || seg[0] === 'manga') && q && seg.length === 1) {
        const m = seg[0] as 'anime' | 'manga'
        resp = json(
          clean(
            env.MAL_CLIENT_ID
              ? m === 'anime'
                ? await searchAnimeOfficial(q, page, env.MAL_CLIENT_ID)
                : await searchMangaOfficial(q, page, env.MAL_CLIENT_ID)
              : await scrapeSearch(m, q, page),
          ),
        )
      }
      // ---- official links: /{anime|manga}/{id}/streaming ----
      // Streaming services for anime, licensed readers for manga.
      else if (
        (seg[0] === 'anime' || seg[0] === 'manga') &&
        /^\d+$/.test(seg[1] || '') &&
        seg[2] === 'streaming'
      ) {
        const media = seg[0] as 'anime' | 'manga'
        const id = parseInt(seg[1], 10)
        const detail = await scrapeDetail(media, id)
        resp = json({ data: detail?.streaming ?? [] }, 200, 60 * 60 * 24)
      }
      // ---- details: /anime/{id}[/full] , /manga/{id}[/full] ----
      // Official API when a key is set; otherwise scrape the MAL detail page
      // (self-sufficient — no Jikan dependency for rank/popularity/etc.).
      else if (
        (seg[0] === 'anime' || seg[0] === 'manga') &&
        /^\d+$/.test(seg[1] || '')
      ) {
        const media = seg[0] as 'anime' | 'manga'
        const id = parseInt(seg[1], 10)
        if (env.MAL_CLIENT_ID) {
          resp = json(
            media === 'anime'
              ? await animeDetailsOfficial(id, env.MAL_CLIENT_ID)
              : await mangaDetailsOfficial(id, env.MAL_CLIENT_ID),
          )
        } else {
          const data = await scrapeDetail(media, id)
          resp = data ? json({ data }) : json({ error: 'Not found' }, 404)
        }
      } else {
        return json({ error: 'Not found', path: url.pathname }, 404)
      }
    } catch (e) {
      if (e instanceof NeedKey)
        return json(
          {
            error:
              'This endpoint needs the official API. Set the MAL_CLIENT_ID secret, or use a scrape-backed endpoint (/seasons/*, /top/manga).',
          },
          501,
        )
      return json({ error: (e as Error).message }, 502)
    }

    ctx.waitUntil(cache.put(cacheKey, resp.clone()))
    return resp
  },
}
