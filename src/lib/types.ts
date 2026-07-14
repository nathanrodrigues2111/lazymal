export type Media = 'anime' | 'manga'

export type SeasonName = 'winter' | 'spring' | 'summer' | 'fall'

export interface Season {
  year: number
  season: SeasonName
}

export interface Genre {
  mal_id: number
  name: string
}

export interface AnimeImage {
  image_url: string
  large_image_url: string
}

/** A single anime entry, trimmed to the fields the UI actually uses. */
export interface Anime {
  mal_id: number
  url: string
  title: string
  title_english: string | null
  title_japanese?: string | null
  rating?: string | null
  images: { jpg: AnimeImage; webp: AnimeImage }
  type: string | null
  episodes: number | null
  status: string | null
  airing: boolean
  // Manga-only fields (present when browsing manga)
  chapters?: number | null
  volumes?: number | null
  publishing?: boolean
  authors?: Genre[]
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
  genres: Genre[]
  themes: Genre[]
  studios: Genre[]
  trailer?: { youtube_id: string | null; url: string | null }
}

export interface JikanPagination {
  last_visible_page: number
  has_next_page: boolean
  current_page: number
}

export interface SeasonResponse {
  data: Anime[]
  pagination: JikanPagination
}

export type SortKey =
  | 'airing'
  | 'score'
  | 'popularity'
  | 'members'
  | 'title'
  | 'newest'
