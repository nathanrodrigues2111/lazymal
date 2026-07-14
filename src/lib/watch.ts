/**
 * Streaming sources for the "Watch online" launcher. Each entry builds a search
 * URL for a given title so tapping it lands on that site's results page.
 *
 * These are community sites (see https://fmhy.net/video) that rotate domains
 * often — keep this list short and current, and lean on the FMHY link in the UI
 * for fresh mirrors when one goes down.
 */
export interface WatchSource {
  name: string
  build: (title: string) => string
}

export const FMHY_VIDEO = 'https://fmhy.net/video'

export const WATCH_SOURCES: WatchSource[] = [
  { name: 'HiAnime', build: (t) => `https://hianime.to/search?keyword=${enc(t)}` },
  { name: 'Miruro', build: (t) => `https://www.miruro.tv/search?q=${enc(t)}` },
  { name: 'AnimePahe', build: (t) => `https://animepahe.ru/anime?q=${enc(t)}` },
  { name: 'AnimeParadise', build: (t) => `https://www.animeparadise.moe/search?q=${enc(t)}` },
  { name: 'AllAnime', build: (t) => `https://allmanga.to/search?q=${enc(t)}` },
  { name: 'KickAssAnime', build: (t) => `https://kaa.mx/search?q=${enc(t)}` },
]

function enc(title: string): string {
  return encodeURIComponent(title.trim())
}
