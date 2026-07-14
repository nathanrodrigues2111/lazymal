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
import { scrapeAdaptedManga, scrapeSeason } from './scrape'
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': status === 200 ? 'public, max-age=1800' : 'no-store',
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

    // Edge cache.
    const cache = caches.default
    const cacheKey = new Request(req.url, { method: 'GET' })
    const hit = await cache.match(cacheKey)
    if (hit) return hit

    const url = new URL(req.url)
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
      // ---- search: /anime?q= , /manga?q= (official) ----
      else if (seg[0] === 'anime' && q && seg.length === 1) {
        resp = json(clean(await searchAnimeOfficial(q, page, key(env))))
      } else if (seg[0] === 'manga' && q && seg.length === 1) {
        resp = json(clean(await searchMangaOfficial(q, page, key(env))))
      }
      // ---- details: /anime/{id}[/full] , /manga/{id}[/full] (official) ----
      else if (seg[0] === 'anime' && /^\d+$/.test(seg[1] || '')) {
        resp = json(await animeDetailsOfficial(parseInt(seg[1], 10), key(env)))
      } else if (seg[0] === 'manga' && /^\d+$/.test(seg[1] || '')) {
        resp = json(await mangaDetailsOfficial(parseInt(seg[1], 10), key(env)))
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
