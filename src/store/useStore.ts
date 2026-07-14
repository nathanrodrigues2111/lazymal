import { create } from 'zustand'
import type { Anime, Season, SortKey } from '../lib/types'
import { fetchNow, fetchSeason } from '../lib/jikan'
import { currentSeason, sameSeason } from '../lib/season'
import { readCache, writeCache } from '../lib/cache'

interface StoreState {
  season: Season
  anime: Anime[]
  status: 'idle' | 'loading' | 'ready' | 'error'

  genreIds: number[]
  sort: SortKey
  query: string

  selected: Anime | null

  load: () => Promise<void>
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
    const { season } = get()
    const isNow = sameSeason(season, currentSeason())

    // Show cached titles instantly (stale-while-revalidate) so the grid never
    // blanks out, even if the API is 504-ing.
    const cached = isNow ? readCache('now') : null
    if (cached) set({ anime: cached.data, status: 'ready' })
    else set({ status: 'loading', anime: [] })

    try {
      const anime = isNow
        ? await fetchNow(controller.signal)
        : await fetchSeason(season, controller.signal)
      if (id !== requestId) return
      if (isNow) writeCache('now', anime)
      // Update to the full fresh list once (single reflow, no per-page shifting).
      set({ anime, status: 'ready' })
    } catch (e) {
      if (id !== requestId || (e as Error).name === 'AbortError') return
      // Keep showing cached data on failure; only error if we have nothing.
      if (!cached) set({ status: 'error' })
    }
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
