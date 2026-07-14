import { create } from 'zustand'
import type { Anime, Media, Season, SortKey } from '../lib/types'
import { fetchManga, fetchNow, fetchSeason } from '../lib/jikan'
import { currentSeason, sameSeason } from '../lib/season'
import { readCache, writeCache } from '../lib/cache'

interface StoreState {
  media: Media
  season: Season
  anime: Anime[]
  status: 'idle' | 'loading' | 'ready' | 'error'

  genreIds: number[]
  sort: SortKey
  query: string

  selected: Anime | null

  load: () => Promise<void>
  setMedia: (media: Media) => void
  setSeason: (season: Season) => void
  toggleGenre: (id: number) => void
  clearGenres: () => void
  setSort: (sort: SortKey) => void
  setQuery: (query: string) => void
  select: (anime: Anime | null) => void
}

// Token so stale responses are dropped when the user switches seasons quickly.
let requestId = 0
let controller: AbortController | null = null

export const useStore = create<StoreState>((set, get) => ({
  media: 'anime',
  season: currentSeason(),
  anime: [],
  status: 'idle',

  genreIds: [],
  sort: 'score',
  query: '',

  selected: null,

  load: async () => {
    const id = ++requestId
    controller?.abort()
    controller = new AbortController()
    const { media, season } = get()
    const isNow = media === 'anime' && sameSeason(season, currentSeason())
    // Cache key: manga, the live anime season, or a specific past season.
    const cacheKey =
      media === 'manga' ? 'manga' : isNow ? 'anime-now' : 'anime-past'
    const cacheable = media === 'manga' || isNow

    // Show cached titles instantly (stale-while-revalidate) so the grid never
    // blanks out, even if the API is 504-ing.
    const cached = cacheable ? readCache(cacheKey) : null
    if (cached) set({ anime: cached.data, status: 'ready' })
    else set({ status: 'loading', anime: [] })

    try {
      let anime: Anime[]
      if (media === 'manga') anime = await fetchManga(controller.signal)
      else if (isNow) anime = await fetchNow(controller.signal)
      else anime = await fetchSeason(season, controller.signal)
      if (id !== requestId) return
      if (cacheable) writeCache(cacheKey, anime)
      // Update to the full fresh list once (single reflow, no per-page shifting).
      set({ anime, status: 'ready' })
    } catch (e) {
      if (id !== requestId || (e as Error).name === 'AbortError') return
      // Keep showing cached data on failure; only error if we have nothing.
      if (!cached) set({ status: 'error' })
    }
  },

  setMedia: (media) => {
    if (media === get().media) return
    set({ media, genreIds: [], query: '', sort: 'score', selected: null })
    void get().load()
  },

  setSeason: (season) => {
    if (sameSeason(season, get().season)) return
    set({ season, genreIds: [], query: '' })
    void get().load()
  },

  toggleGenre: (id) =>
    set((s) => ({
      genreIds: s.genreIds.includes(id)
        ? s.genreIds.filter((g) => g !== id)
        : [...s.genreIds, id],
    })),

  clearGenres: () => set({ genreIds: [] }),
  setSort: (sort) => set({ sort }),
  setQuery: (query) => set({ query }),
  select: (selected) => set({ selected }),
}))
