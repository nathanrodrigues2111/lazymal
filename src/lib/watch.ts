/**
 * "Watch online" sources. Each builds a search URL for a title. Miruro indexes
 * by the romaji title; AniKoto by the English one — so each picks the form that
 * matches best. FMHY is linked as a fallback directory when sites move domains.
 */
export const FMHY_VIDEO = 'https://fmhy.net/video'

export interface WatchTitle {
  romaji: string
  english: string | null
}

export interface WatchSource {
  name: string
  build: (t: WatchTitle) => string
}

export const WATCH_SOURCES: WatchSource[] = [
  {
    name: 'Miruro',
    build: ({ romaji }) => `https://www.miruro.tv/search?q=${enc(romaji)}`,
  },
  {
    name: 'AniKoto',
    build: ({ romaji, english }) =>
      `https://anikototv.to/filter?keyword=${enc(english || romaji)}`,
  },
]

function enc(title: string): string {
  return encodeURIComponent(title.trim())
}
