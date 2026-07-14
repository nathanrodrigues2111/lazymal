/**
 * "Watch online" sources. Each builds a search URL for a title. Miruro indexes
 * by the romaji title; AniKoto by the English one — so each picks the form that
 * matches best. FMHY is linked as a fallback directory when sites move domains.
 */
export const FMHY_VIDEO = 'https://fmhy.net/video'
export const FMHY_READING = 'https://fmhy.net/readingpiracyguide'

export interface WatchTitle {
  romaji: string
  english: string | null
}

export interface WatchSource {
  name: string
  /** Homepage, pinged to show an online/offline status dot. */
  home: string
  build: (t: WatchTitle) => string
}

export const WATCH_SOURCES: WatchSource[] = [
  {
    name: 'Miruro',
    home: 'https://www.miruro.tv',
    build: ({ romaji }) => `https://www.miruro.tv/search?query=${enc(romaji)}`,
  },
  {
    name: 'AniKoto',
    home: 'https://anikototv.to',
    build: ({ romaji, english }) =>
      `https://anikototv.to/filter?keyword=${enc(english || romaji)}`,
  },
]

/** Manga readers for the "Read online" launcher. */
export const READ_SOURCES: WatchSource[] = [
  {
    name: 'MangaDex',
    home: 'https://mangadex.org',
    build: ({ english, romaji }) =>
      `https://mangadex.org/search?q=${enc(english || romaji)}`,
  },
  {
    name: 'Comick',
    home: 'https://comick.io',
    build: ({ english, romaji }) =>
      `https://comick.io/search?q=${enc(english || romaji)}`,
  },
]

export type SiteStatus = 'checking' | 'up' | 'down'

/**
 * Best-effort reachability check: a `no-cors` request resolves if the domain is
 * reachable and rejects on DNS/connection failure (the usual way these rotating
 * sites die). It can't read the HTTP status (opaque response), so a site that's
 * up but erroring still shows as online.
 */
export function pingSite(home: string, timeoutMs = 6000): Promise<boolean> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  return fetch(home, { mode: 'no-cors', signal: ctrl.signal })
    .then(() => true)
    .catch(() => false)
    .finally(() => clearTimeout(timer))
}

function enc(title: string): string {
  return encodeURIComponent(title.trim())
}
