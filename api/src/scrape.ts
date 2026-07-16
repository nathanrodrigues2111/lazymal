/** Default path: scrape MyAnimeList's public HTML pages, the same way Jikan
 * (github.com/jikan-me/jikan) does — no API key required. Parsing runs on the
 * Cloudflare Workers runtime via the global `HTMLRewriter`, which streams the
 * document in order; cheerio/jsdom/DOMParser are NOT available here.
 *
 * The scraper emits the exact Jikan-v4-compatible shapes from `./shape`, so the
 * frontend can't tell whether a response came from the official API or here. */

import { buildImages, type ListResponse, type MalItem } from './shape'

// Browser-like headers so MAL doesn't serve us a bot-block page.
export const HEADERS = {
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

/** Upgrade a MAL thumbnail URL to full resolution: strip the `/r/WxH/` resize
 * segment and the `?s=` cache-buster query. */
function bigImage(url: string): string {
  return url.replace(/\/r\/\d+x\d+\//, '/').replace(/\?.*$/, '')
}

/** Stable numeric id for a genre name (MAL's real ids aren't in the scraped
 * HTML). Same name → same id, so dedup/filtering/React keys all work. */
function gid(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0
  return Math.abs(h) || 1
}

/** Decode HTML entities HTMLRewriter leaves in text. MAL often double-encodes
 * (e.g. `&amp;#039;`), so `&amp;` is unwound first, then numeric/named. */
function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
}

// Legal/official services MAL links on a detail page, matched by domain. Order
// = display order. Kept to unambiguous domains so a stray footer/social link
// can't be mistaken for an official listing. Anime = streaming; manga = readers.
const STREAMING_SITES: { name: string; match: RegExp }[] = [
  { name: 'Crunchyroll', match: /crunchyroll\.com/i },
  { name: 'Netflix', match: /netflix\.com/i },
  { name: 'HIDIVE', match: /hidive\.com/i },
  { name: 'Hulu', match: /hulu\.com/i },
  { name: 'Amazon Prime Video', match: /primevideo\.com/i },
  { name: 'Disney+', match: /disneyplus\.com/i },
  { name: 'Max', match: /(hbomax|\bmax)\.com/i },
  { name: 'Bilibili', match: /bilibili\.(tv|com)/i },
]

const READER_SITES: { name: string; match: RegExp }[] = [
  { name: 'Manga Plus', match: /mangaplus\.shueisha\.co\.jp/i },
  { name: 'Viz', match: /viz\.com/i },
  { name: 'K Manga', match: /kmanga\.kodansha\.com/i },
  { name: 'Comikey', match: /comikey\.com/i },
  { name: 'Azuki', match: /azuki\.co/i },
  { name: 'INKR', match: /inkr\.com/i },
  { name: 'BookWalker', match: /bookwalker\.jp/i },
  { name: 'Amazon Kindle', match: /amazon\.[a-z.]+\/.*(kindle|dp\/)/i },
]

/** Pull official links out of a detail page's HTML, one per service, in the
 * given priority order. Empty when none are listed. */
function extractLinks(
  html: string,
  sites: { name: string; match: RegExp }[],
): { name: string; url: string }[] {
  const found = new Map<string, string>()
  const anchorRe = /href="(https?:\/\/[^"]+)"/gi
  let m: RegExpExecArray | null
  while ((m = anchorRe.exec(html))) {
    const href = m[1]
    for (const s of sites) {
      if (!found.has(s.name) && s.match.test(href)) {
        found.set(s.name, href.replace(/&amp;/g, '&'))
      }
    }
  }
  // Keep priority order regardless of DOM order.
  return sites
    .filter((s) => found.has(s.name))
    .map((s) => ({ name: s.name, url: found.get(s.name)! }))
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
        if (cur && !cur.title) cur.title = decode(v.trim())
      }),
    })
    // Cover image — MAL lazy-loads, so prefer data-src over src.
    .on('div.js-seasonal-anime .image img', {
      element(el) {
        if (!cur) return
        const src = el.getAttribute('data-src') || el.getAttribute('src') || ''
        if (src) cur.images = buildImages(bigImage(src))
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
    // Genre anchors carry MAL's real id/type/url in the href
    // (/{anime|manga}/genre/{id}/Name).
    .on('div.js-seasonal-anime .genre a', {
      element(el) {
        if (!cur) return
        const href = el.getAttribute('href') || ''
        const m = href.match(/\/(anime|manga)\/genre\/(\d+)/)
        cur.genres.push({
          mal_id: m ? parseInt(m[2], 10) : 0,
          type: m ? m[1] : undefined,
          name: '',
          url: href
            ? href.startsWith('http')
              ? href
              : `https://myanimelist.net${href}`
            : undefined,
        })
      },
      text: textSink((v) => {
        if (!cur || !cur.genres.length) return
        const g = cur.genres[cur.genres.length - 1]
        if (!g.name) {
          g.name = decode(v.trim())
          if (!g.mal_id) g.mal_id = gid(g.name)
        }
      }),
    })
    // Synopsis — strip a trailing "[Written by ...]" credit.
    .on('div.js-seasonal-anime .synopsis .preline', {
      text: textSink((v) => {
        if (!cur || cur.synopsis) return
        const s = decode(v.replace(/\[Written by[^\]]*\]\s*$/i, '').trim())
        cur.synopsis = s || null
      }),
    })
    .transform(res)
    .arrayBuffer() // consume the stream so all handlers run

  const data = items.filter((it) => it.mal_id && it.title)
  for (const it of data) it.genres = it.genres.filter((g) => g.name)
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
        if (cur && !cur.title) cur.title = decode(v.trim())
      }),
    })
    // Cover thumbnail (small thumb is fine here) — data-src before src.
    .on('tr.ranking-list .title img', {
      element(el) {
        if (!cur) return
        const src = el.getAttribute('data-src') || el.getAttribute('src') || ''
        if (src) cur.images = buildImages(bigImage(src))
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
        if (cur && !cur.title) cur.title = decode(v.trim())
      }),
    })
    .on('div.js-seasonal-anime .image img', {
      element(el) {
        if (!cur) return
        const src = el.getAttribute('data-src') || el.getAttribute('src') || ''
        if (src) cur.images = buildImages(bigImage(src))
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
    // Genre anchors carry MAL's real id/type/url in the href
    // (/{anime|manga}/genre/{id}/Name).
    .on('div.js-seasonal-anime .genre a', {
      element(el) {
        if (!cur) return
        const href = el.getAttribute('href') || ''
        const m = href.match(/\/(anime|manga)\/genre\/(\d+)/)
        cur.genres.push({
          mal_id: m ? parseInt(m[2], 10) : 0,
          type: m ? m[1] : undefined,
          name: '',
          url: href
            ? href.startsWith('http')
              ? href
              : `https://myanimelist.net${href}`
            : undefined,
        })
      },
      text: textSink((v) => {
        if (!cur || !cur.genres.length) return
        const g = cur.genres[cur.genres.length - 1]
        if (!g.name) {
          g.name = decode(v.trim())
          if (!g.mal_id) g.mal_id = gid(g.name)
        }
      }),
    })
    .on('div.js-seasonal-anime .synopsis .preline', {
      text: textSink((v) => {
        if (!cur || cur.synopsis) return
        const s = decode(v.replace(/\[Written by[^\]]*\]\s*$/i, '').trim())
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
    it.genres = it.genres.filter((g) => g.name)
  }
  return { data, pagination: { current_page: 1, has_next_page: false } }
}

// --- single-title detail scraper -------------------------------------------

/**
 * Scrape one title's detail page (`/anime/{id}` or `/manga/{id}`).
 *
 * The detail page is large and its sidebar is a long list of
 * `<span class="dark_text">Label:</span> value` pairs plus a statistics block.
 * HTMLRewriter is awkward for reading the sibling text that follows each label,
 * so we regex the raw HTML instead. Every extraction is optional — parsing runs
 * inside try/catch and we return the partial item even when fields are missing.
 */
export async function scrapeDetail(
  media: 'anime' | 'manga',
  id: number,
): Promise<MalItem | null> {
  const url = `https://myanimelist.net/${media}/${id}`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return null
  const html = await res.text()

  const it = blankItem()
  it.mal_id = id
  it.url = url

  try {
    // Trimmed text right after a `Label:</span>` sidebar entry (plain values;
    // anchor-wrapped values won't match, since the next char is `<`).
    const field = (label: string): string | undefined =>
      html
        .match(new RegExp(label + ':<\\/span>\\s*([^<\\r\\n]+)', 'i'))?.[1]
        ?.trim()

    // Title.
    const title = html.match(
      /<h1[^>]*class="title-name[^"]*"[^>]*>\s*<strong>([^<]+)<\/strong>/i,
    )?.[1]
    if (title) it.title = decode(title.trim())

    // Alternative titles.
    const eng = field('English')
    if (eng) it.title_english = decode(eng)
    const jpn = field('Japanese')
    if (jpn) it.title_japanese = decode(jpn)

    // Type — usually an anchor, occasionally plain text.
    const type =
      html.match(/Type:<\/span>[\s\S]{0,80}?>([^<]+)<\/a>/i)?.[1] || field('Type')
    if (type) it.type = decode(type.trim())

    // Counts. "Unknown" → null.
    const eps = field('Episodes')
    if (eps) it.episodes = /unknown/i.test(eps) ? null : toInt(eps)
    const chapters = field('Chapters')
    if (chapters !== undefined)
      it.chapters = /unknown/i.test(chapters) ? null : toInt(chapters)
    const volumes = field('Volumes')
    if (volumes !== undefined)
      it.volumes = /unknown/i.test(volumes) ? null : toInt(volumes)

    // Status → airing (anime) / publishing (manga) flags.
    const status = field('Status')
    if (status) {
      it.status = decode(status)
      it.airing = /airing/i.test(status)
      it.publishing = /publishing/i.test(status)
    }

    // Content rating (anime), e.g. "PG-13 - Teens 13 or older".
    const rating = field('Rating')
    if (rating) it.rating = decode(rating)

    // Member count.
    it.members = toInt(field('Members'))

    // Statistics block.
    it.score = toScore(html.match(/itemprop="ratingValue"[^>]*>\s*([\d.]+)/i)?.[1])
    it.scored_by = toInt(html.match(/itemprop="ratingCount"[^>]*>\s*([\d,]+)/i)?.[1])
    it.rank = toInt(html.match(/Ranked:<\/span>[\s\S]{0,40}?#([\d,]+)/i)?.[1])
    it.popularity = toInt(html.match(/Popularity:<\/span>[\s\S]{0,20}?#([\d,]+)/i)?.[1])

    // Synopsis — strip inner tags and a trailing "[Written by ...]" credit.
    const syn = html.match(/<p itemprop="description">([\s\S]*?)<\/p>/i)?.[1]
    if (syn) {
      const clean = decode(syn.replace(/<[^>]+>/g, ''))
        .replace(/\[Written by[^\]]*\]\s*$/i, '')
        .trim()
      it.synopsis = clean || null
    }

    // Poster image — MAL lazy-loads, so data-src may hold the real URL.
    const img = html.match(/itemprop="image"[^>]*(?:data-src|src)="([^"]+)"/i)?.[1]
    if (img) it.images = buildImages(bigImage(img))

    // Genres / themes / demographics all render as `/genre/{id}/Name` anchors.
    // Collect every one, deduped by id. (Shape lumps them into `genres`.)
    const seen = new Set<number>()
    const genreRe =
      /href="(\/(anime|manga)\/genre\/(\d+)\/[^"]+)"[^>]*>([^<]+)<\/a>/g
    let gm: RegExpExecArray | null
    while ((gm = genreRe.exec(html))) {
      const gidNum = +gm[3]
      if (seen.has(gidNum)) continue
      seen.add(gidNum)
      it.genres.push({
        mal_id: gidNum,
        type: gm[2],
        name: decode(gm[4].trim()),
        url: `https://myanimelist.net${gm[1]}`,
      })
    }
    it.themes = []

    // Studios (anime) / Authors (manga): grab the label's block up to the next
    // `</div>`, then pull anchor ids + names. Best-effort; empty on any miss.
    if (media === 'anime') {
      const block = html.match(/Studios:<\/span>([\s\S]*?)<\/div>/i)?.[1]
      if (block) {
        const re = /href="\/anime\/producer\/(\d+)\/[^"]*"[^>]*>([^<]+)<\/a>/g
        let m: RegExpExecArray | null
        while ((m = re.exec(block)))
          it.studios.push({ mal_id: +m[1], name: decode(m[2].trim()) })
      }
    } else {
      const block = html.match(/Authors:<\/span>([\s\S]*?)<\/div>/i)?.[1]
      it.authors = []
      if (block) {
        const re = /href="\/people\/(\d+)\/[^"]*"[^>]*>([^<]+)<\/a>/g
        let m: RegExpExecArray | null
        while ((m = re.exec(block)))
          it.authors.push({ mal_id: +m[1], name: decode(m[2].trim()) })
      }
    }

    // season / year from "Premiered:" (anime only, optional).
    if (media === 'anime') {
      const prem = html.match(/Premiered:<\/span>[\s\S]{0,80}?>([^<]+)<\/a>/i)?.[1]
      const pm = prem?.trim().match(/([A-Za-z]+)\s+(\d{4})/)
      if (pm) {
        it.season = pm[1].toLowerCase()
        it.year = parseInt(pm[2], 10)
      }

      // Broadcast schedule, e.g. "Broadcast:</span> Saturdays at 23:30 (JST)".
      // Powers the "Next episode" countdown in the detail sheet.
      const bstr = field('Broadcast')
      if (bstr && !/unknown|not\s+scheduled|n\/?a/i.test(bstr)) {
        const bm = bstr.match(/([A-Za-z]+days?)\s+at\s+(\d{1,2}:\d{2})/i)
        if (bm) {
          it.broadcast = {
            day: bm[1],
            time: bm[2],
            timezone: /\(([^)]+)\)/.exec(bstr)?.[1] || 'JST',
            string: decode(bstr.trim()),
          }
        }
      }
    }
    // Official links MAL lists on the detail page — streaming services for
    // anime, licensed readers for manga — so we can offer real, per-title legal
    // viewing/reading options.
    it.streaming = extractLinks(
      html,
      media === 'anime' ? STREAMING_SITES : READER_SITES,
    )
  } catch {
    // Return whatever we managed to fill in.
  }

  return it
}

// Note: dub detection lives in the frontend (it queries AniList directly, which
// 403s Cloudflare Worker requests but allows browser CORS).

// --- search scraper --------------------------------------------------------

/**
 * Scrape `/{anime|manga}.php` search results, which paginate 50 rows at a time
 * via `?show=` (an offset, not a page number).
 *
 * Results render as a table whose rows mix a cover-image cell and a title cell.
 * HTMLRewriter is awkward for reading across these sibling cells, so we regex
 * the raw HTML — the same approach the detail scraper uses. Each row's title
 * lives in the first `a.hoverinfo_trigger`; a second such anchor (the image
 * link) has empty text, so we skip empties and de-dupe by id.
 */
export async function scrapeSearch(
  media: 'anime' | 'manga',
  q: string,
  page: number,
): Promise<ListResponse> {
  const url = `https://myanimelist.net/${media}.php?q=${encodeURIComponent(q)}&cat=${media}&show=${(page - 1) * 50}`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`MAL page responded ${res.status}`)
  const html = await res.text()

  const data: MalItem[] = []
  const seen = new Set<number>()

  try {
    // Each result row starts with the poster's image anchor (picSurround),
    // whose href carries the id. Slicing between consecutive image anchors
    // yields exactly one row's HTML (image → title → synopsis → columns).
    const rowRe = new RegExp(
      `<a\\s+class="hoverinfo_trigger"\\s+href="https://myanimelist\\.net/${media}/(\\d+)/`,
      'g',
    )
    const anchors = [...html.matchAll(rowRe)]

    for (let i = 0; i < anchors.length; i++) {
      const id = parseInt(anchors[i][1], 10)
      if (!id || seen.has(id)) continue

      const start = anchors[i].index ?? 0
      const end = anchors[i + 1]?.index ?? html.length
      const slice = html.slice(start, end)

      // Title lives in the row's <strong> (inside the fw-b title anchor).
      const title = slice.match(/<strong>([^<]+)<\/strong>/)?.[1]?.trim()
      if (!title) continue

      const it = blankItem()
      it.mal_id = id
      it.url = `https://myanimelist.net/${media}/${id}`
      it.title = decode(title)

      // Cover image (lazy-loaded via data-src, an r/WxH resize thumb).
      const img = slice.match(
        /data-src="(https:\/\/cdn\.myanimelist\.net\/[^"]+?\/images\/(?:anime|manga)\/\d+\/\d+\.[a-z]+)[^"]*"/i,
      )?.[1]
      if (img) it.images = buildImages(bigImage(img))

      // Synopsis preview (truncated on the page; strip the trailing ellipsis).
      const syn = slice.match(/<div class="pt4">([\s\S]*?)(?:<a\b|<\/div>)/)?.[1]
      if (syn)
        it.synopsis =
          decode(syn.replace(/\s+/g, ' ').trim()).replace(/\.{2,}$/, '') || null

      // Right-hand columns (class "… ac …"): type, episodes/chapters, score —
      // classified by shape since column order varies between anime and manga.
      const cells = [
        ...slice.matchAll(
          /<td class="[^"]*\bac\b[^"]*"[^>]*>\s*([^<]+?)\s*<\/td>/g,
        ),
      ].map((c) => c[1].trim())
      for (const c of cells) {
        if (/^\d+(\.\d+)?$/.test(c) && c.includes('.')) it.score = toScore(c)
        else if (/^\d+$/.test(c)) {
          const n = toInt(c)
          if (media === 'manga') it.chapters = n
          else it.episodes = n
        } else if (!it.type && /[A-Za-z]/.test(c)) it.type = c
      }

      // Mark manga so the frontend renders it in manga mode.
      if (media === 'manga' && it.chapters === undefined) it.chapters = null

      seen.add(id)
      data.push(it)
    }
  } catch {
    // Return whatever we managed to gather.
  }

  return {
    data,
    pagination: {
      current_page: page,
      has_next_page: data.length >= 50,
    },
  }
}
