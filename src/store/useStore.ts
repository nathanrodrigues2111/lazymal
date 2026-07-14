import { create } from 'zustand'
import type { Anime, SortKey } from '../lib/types'
import { fetchNow } from '../lib/jikan'

interface StoreState {
  anime: Anime[]
  status: 'idle' | 'loading' | 'ready' | 'error'

  genreIds: number[]
  sort: SortKey
  query: string

  selected: Anime | null

  load: () => Promise<void>
  toggleGenre: (id: number) => void
  clearGenres: () => void
  setSort: (sort: SortKey) => void
  setQuery: (query: string) => void
  select: (anime: Anime | null) => void
}

let controller: AbortController | null = null

export const useStore = create<StoreState>((set) => ({
  anime: [],
  status: 'idle',

  genreIds: [],
  sort: 'score',
  query: '',

  selected: null,

  load: async () => {
    controller?.abort()
    controller = new AbortController()
    set({ status: 'loading' })
    try {
      const anime = await fetchNow(controller.signal)
      set({ anime, status: 'ready' })
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      set({ status: 'error' })
    }
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
