/** Default path: scrape MyAnimeList's public HTML pages, the same way Jikan
 * (github.com/jikan-me/jikan) does — no API key required. Parsing runs on the
 * Cloudflare Workers runtime via the global `HTMLRewriter`, which streams the
 * document in order; cheerio/jsdom/DOMParser are NOT available here.
 *
 * The scraper emits the exact Jikan-v4-compatible shapes from `./shape`, so the
 * frontend can't tell whether a response came from the official API or here. */

import { buildImages, type ListResponse, type MalItem } from './shape'

// Browser-like headers so MAL doesn't serve us a bot-block page.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  Accept: 'text/html',
  'Accept-Language': 'en-US,en;q=0.9',
}

// MAL tags each season card with `js-anime-type-{N}`; map N → a type label.
const ANIME_TYPE_BY_ID: Record<string, string> = {
  '1': 'TV',
  '2': 'OVA',
  '3': 'Movie',
  '4': 'Special',
  '5': 'ONA',
  '6': 'Music',
}
// Tokens we recognise as a manga "type" when scanning free-form row text.
const MANGA_TYPES = [
  'Manga',
  'Manhwa',
  'Manhua',
  'Light Novel',
  'Novel',
  'One-shot',
  'Doujinshi',
]

// --- parse helpers ---------------------------------------------------------

/** Strip everything but digits (drops thousands separators, icons, labels)
 * then parseInt; null when there's nothing numeric. */
function toInt(s: string | null | undefined): number | null {
  if (!s) return null
  const digits = s.replace(/[^\d]/g, '')
  if (!digits) return null
  const n = parseInt(digits, 10)
  return Number.isNaN(n) ? null : n
}

/** Parse a score like `8.45`; `N/A` (or anything non-numeric) → null. */
function toScore(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.match(/\d+(?:\.\d+)?/)
  if (!m) return null
  const n = parseFloat(m[0])
  return Number.isNaN(n) ? null : n
}

/** Parse an abbreviated count like `328K`, `1.2M`, or `1,234` → integer. */
function toCompactInt(s: string | null | undefined): number | null {
  if (!s) return null
  const m = s.replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i)
  if (!m) return null
  let n = parseFloat(m[1])
  if (Number.isNaN(n)) return null
  const suf = (m[2] || '').toUpperCase()
  if (suf === 'K') n *= 1e3
  else if (suf === 'M') n *= 1e6
  else if (suf === 'B') n *= 1e9
  return Math.round(n)
}

/** Fresh MalItem with every field defaulted; handlers fill in what they find. */
function blankItem(): MalItem {
  return {
    mal_id: 0,
    url: '',
    title: '',
    title_english: null,
    images: buildImages(''),
    type: null,
    episodes: null,
    status: null,
    airing: false,
    score: null,
    scored_by: null,
    rank: null,
    popularity: null,
    members: null,
    synopsis: null,
    season: null,
    year: null,
    genres: [],
    themes: [],
    studios: [],
  }
}

/** Small accumulator for one logical piece of text. HTMLRewriter delivers text
 * in chunks, so we concatenate until `lastInTextNode`, then hand the joined
 * value to a sink and reset. */
function textSink(onDone: (value: string) => void) {
  let buf = ''
  return (t: Text) => {
    buf += t.text
    if (t.lastInTextNode) {
      const value = buf
      buf = ''
      onDone(value)
    }
  }
}

// --- season scraper --------------------------------------------------------

/**
 * Scrape a whole season from `/anime/season/{year}/{season}`.
 *
 * MAL renders the entire season on a single HTML page (no server pagination),
 * so pages beyond 1 are empty — returning `has_next_page: false` lets the
 * frontend's page loop terminate.
 */
export async function scrapeSeason(
  year: number,
  season: string,
  page: number,
): Promise<ListResponse> {
  if (page > 1) {
    return { data: [], pagination: { current_page: page, has_next_page: false } }
  }

  const url = `https://myanimelist.net/anime/season/${year}/${season}`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`MAL page responded ${res.status}`)

  const items: MalItem[] = []
  let cur: MalItem | null = null

  await new HTMLRewriter()
    // Each anime is a `div.seasonal-anime.js-seasonal-anime`. Start a new item.
    .on('div.js-seasonal-anime', {
      element(el) {
        cur = blankItem()
        cur.season = season
        cur.year = year
        // Media type is encoded in the card's class (js-anime-type-{N}).
        const t = (el.getAttribute('class') || '').match(/js-anime-type-(\d+)/)
        if (t) cur.type = ANIME_TYPE_BY_ID[t[1]] || null
        items.push(cur)
      },
    })
    // Title + URL + id from the title anchor.
    .on('div.js-seasonal-anime .h2_anime_title a.link-title', {
      element(el) {
        if (!cur) return
        const href = el.getAttribute('href') || ''
        const m = href.match(/anime\/(\d+)/)
        if (m) {
          cur.mal_id = parseInt(m[1], 10)
          cur.url = `https://myanimelist.net/anime/${cur.mal_id}`
        }
      },
      text: textSink((v) => {
        if (cur && !cur.title) cur.title = v.trim()
      }),
    })
    // Cover image — MAL lazy-loads, so prefer data-src over src.
    .on('div.js-seasonal-anime .image img', {
      element(el) {
        if (!cur) return
        const src = el.getAttribute('data-src') || el.getAttribute('src') || ''
        if (src) cur.images = buildImages(src)
      },
    })
    // Score value (e.g. `8.45`; `N/A` → null).
    .on('div.js-seasonal-anime span.js-score', {
      text: textSink((v) => {
        if (cur && cur.score === null) cur.score = toScore(v)
      }),
    })
    // Member count (e.g. `1,234`).
    .on('div.js-seasonal-anime span.js-members', {
      text: textSink((v) => {
        if (cur && cur.members === null) cur.members = toInt(v)
      }),
    })
    // `.info` holds date · eps · duration; pull the eps count from it.
    .on('div.js-seasonal-anime .info', {
      text: textSink((v) => {
        if (!cur || cur.episodes !== null) return
        const eps = v.match(/(\d+)\s*eps/i)
        if (eps) cur.episodes = parseInt(eps[1], 10)
      }),
    })
    // Genre anchors — no reliable id in the markup, so mal_id: 0 (frontend
    // matches genres by name).
    .on('div.js-seasonal-anime .genre a', {
      text: textSink((v) => {
        const name = v.trim()
        if (cur && name) cur.genres.push({ mal_id: 0, name })
      }),
    })
    // Synopsis — strip a trailing "[Written by ...]" credit.
    .on('div.js-seasonal-anime .synopsis .preline', {
      text: textSink((v) => {
        if (!cur || cur.synopsis) return
        const s = v.replace(/\[Written by[^\]]*\]\s*$/i, '').trim()
        cur.synopsis = s || null
      }),
    })
    .transform(res)
    .arrayBuffer() // consume the stream so all handlers run

  const data = items.filter((it) => it.mal_id && it.title)
  return { data, pagination: { current_page: 1, has_next_page: false } }
}

// --- top-manga scraper -----------------------------------------------------

/**
 * Scrape `/topmanga.php`, which paginates 50 rows at a time via `?limit=`
 * (the offset, not a page size).
 */
export async function scrapeTopManga(page: number): Promise<ListResponse> {
  const offset = (page - 1) * 50
  const url = `https://myanimelist.net/topmanga.php?limit=${offset}`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`MAL page responded ${res.status}`)

  const items: MalItem[] = []
  let cur: MalItem | null = null

  await new HTMLRewriter()
    // Each ranked entry is a `tr.ranking-list`.
    .on('tr.ranking-list', {
      element() {
        cur = blankItem()
        items.push(cur)
      },
    })
    // Rank number.
    .on('tr.ranking-list .rank span', {
      text: textSink((v) => {
        if (cur && cur.rank === null) cur.rank = toInt(v)
      }),
    })
    // Title + URL + id from the title-cell anchor.
    .on('tr.ranking-list .title a.hoverinfo_trigger', {
      element(el) {
        if (!cur) return
        const href = el.getAttribute('href') || ''
        const m = href.match(/manga\/(\d+)/)
        if (m) {
          cur.mal_id = parseInt(m[1], 10)
          cur.url = `https://myanimelist.net/manga/${cur.mal_id}`
        }
      },
      text: textSink((v) => {
        if (cur && !cur.title) cur.title = v.trim()
      }),
    })
    // Cover thumbnail (small thumb is fine here) — data-src before src.
    .on('tr.ranking-list .title img', {
      element(el) {
        if (!cur) return
        const src = el.getAttribute('data-src') || el.getAttribute('src') || ''
        if (src) cur.images = buildImages(src)
      },
    })
    // Score cell.
    .on('tr.ranking-list .score .text', {
      text: textSink((v) => {
        if (cur && cur.score === null) cur.score = toScore(v)
      }),
    })
    // `.information` cell holds "Manga (100 vols) / Published ... / N members".
    .on('tr.ranking-list .information', {
      text: textSink((v) => {
        if (!cur) return
        if (cur.type === null) {
          const known = MANGA_TYPES.find((t) =>
            new RegExp(`\\b${t}\\b`, 'i').test(v),
          )
          cur.type = known || 'Manga'
        }
        if (cur.volumes == null) {
          const vol = v.match(/(\d+)\s*vols?/i)
          if (vol) cur.volumes = parseInt(vol[1], 10)
        }
        if (cur.members === null) {
          const mem = v.match(/([\d,]+)\s*members/i)
          if (mem) cur.members = toInt(mem[1])
        }
      }),
    })
    .transform(res)
    .arrayBuffer() // consume the stream so all handlers run

  const data = items.filter((it) => it.mal_id && it.title)
  // Manga-specific defaults not present on the ranking page.
  for (const it of data) {
    it.chapters = null
    it.volumes = it.volumes ?? null
    it.authors = []
  }

  return {
    data,
    pagination: {
      current_page: page,
      has_next_page: data.length >= 50,
    },
  }
}

// --- currently-relevant manga scraper --------------------------------------

/**
 * Scrape "Manga Adapted to Anime" filtered to airing adaptations
 * (`/manga/adapted?type=airing`) — a good proxy for currently-relevant /
 * ongoing manga. Reuses the season card layout, but score/members live in
 * `.scormem-item` and counts are abbreviated (e.g. `328K`). Single page.
 */
export async function scrapeAdaptedManga(page: number): Promise<ListResponse> {
  if (page > 1) {
    return { data: [], pagination: { current_page: page, has_next_page: false } }
  }

  const url = 'https://myanimelist.net/manga/adapted?type=airing'
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`MAL page responded ${res.status}`)

  const items: MalItem[] = []
  let cur: MalItem | null = null

  await new HTMLRewriter()
    .on('div.js-seasonal-anime', {
      element() {
        cur = blankItem()
        cur.type = 'Manga'
        items.push(cur)
      },
    })
    // Title cell uses h2_manga_title here, so match the anchor directly.
    .on('div.js-seasonal-anime a.link-title', {
      element(el) {
        if (!cur) return
        const href = el.getAttribute('href') || ''
        const m = href.match(/manga\/(\d+)/)
        if (m) {
          cur.mal_id = parseInt(m[1], 10)
          cur.url = `https://myanimelist.net/manga/${cur.mal_id}`
        }
      },
      text: textSink((v) => {
        if (cur && !cur.title) cur.title = v.trim()
      }),
    })
    .on('div.js-seasonal-anime .image img', {
      element(el) {
        if (!cur) return
        const src = el.getAttribute('data-src') || el.getAttribute('src') || ''
        if (src) cur.images = buildImages(src)
      },
    })
    .on('div.js-seasonal-anime .scormem-item.score', {
      text: textSink((v) => {
        if (cur && cur.score === null) cur.score = toScore(v)
      }),
    })
    .on('div.js-seasonal-anime .scormem-item.member', {
      text: textSink((v) => {
        if (cur && cur.members === null) cur.members = toCompactInt(v)
      }),
    })
    .on('div.js-seasonal-anime .genre a', {
      text: textSink((v) => {
        const name = v.trim()
        if (cur && name) cur.genres.push({ mal_id: 0, name })
      }),
    })
    .on('div.js-seasonal-anime .synopsis .preline', {
      text: textSink((v) => {
        if (!cur || cur.synopsis) return
        const s = v.replace(/\[Written by[^\]]*\]\s*$/i, '').trim()
        cur.synopsis = s || null
      }),
    })
    .transform(res)
    .arrayBuffer()

  const data = items.filter((it) => it.mal_id && it.title)
  // Mark as manga so the frontend renders it in manga mode.
  for (const it of data) {
    it.chapters = null
    it.volumes = null
    it.authors = []
  }
  return { data, pagination: { current_page: 1, has_next_page: false } }
}
