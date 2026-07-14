/** The Jikan-v4-compatible shapes LazyMAL's frontend consumes. Both the
 * official-API path and the HTML-scraper path must produce these. */

export interface Tag {
  mal_id: number
  type?: string
  name: string
  url?: string
}

export interface MalImage {
  image_url: string
  small_image_url: string
  large_image_url: string
}

export interface MalItem {
  mal_id: number
  url: string
  title: string
  title_english: string | null
  title_japanese?: string | null
  rating?: string | null
  images: { jpg: MalImage; webp: MalImage }
  type: string | null
  episodes: number | null
  status: string | null
  airing: boolean
  // manga-only
  chapters?: number | null
  volumes?: number | null
  publishing?: boolean
  authors?: Tag[]
  score: number | null
  scored_by: number | null
  rank: number | null
  popularity: number | null
  members: number | null
  synopsis: string | null
  season: string | null
  year: number | null
  broadcast?: {
    day: string | null
    time: string | null
    timezone: string | null
    string: string | null
  }
  genres: Tag[]
  themes: Tag[]
  studios: Tag[]
}

export interface ListResponse {
  data: MalItem[]
  pagination: { current_page: number; has_next_page: boolean }
}

export function buildImages(url: string, medium?: string): MalItem['images'] {
  const m = medium || url
  const jpg = { image_url: m, small_image_url: m, large_image_url: url }
  return { jpg, webp: { ...jpg } }
}
