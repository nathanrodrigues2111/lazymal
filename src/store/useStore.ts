import { create } from 'zustand'
import type { Anime, DubFilter, Media, Season, SortKey } from '../lib/types'
import { fetchManga, fetchNow, fetchSeason } from '../lib/jikan'
import { currentSeason, sameSeason } from '../lib/season'
import { readCache, writeCache } from '../lib/cache'
import { cachedDub, fetchDubBatch, loadDubCache } from '../lib/dub'

interface StoreState {
  media: Media
  season: Season
  anime: Anime[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  /** Transient toast message shown at the bottom (null = hidden). */
  toast: string | null

  genreIds: number[]
  sort: SortKey
  query: string

  /** Known English-dub availability by mal_id (anime only). */
  dub: Record<number, boolean>
  /** Dub filter: off, dubbed-only, or sub-only. */
  dubFilter: DubFilter
  /** True while dub statuses for the current list are still loading in. */
  dubEnriching: boolean

  selected: Anime | null

  load: () => Promise<void>
  /** Re-fetch the current list and confirm with a toast (user-triggered). */
  refresh: () => Promise<void>
  showToast: (message: string) => void
  /** Warm the OTHER media's cache in the background so toggling is instant. */
  prewarmOther: () => Promise<void>
  setMedia: (media: Media) => void
  setSeason: (season: Season) => void
  toggleGenre: (id: number) => void
  clearGenres: () => void
  setSort: (sort: SortKey) => void
  setQuery: (query: string) => void
  select: (anime: Anime | null) => void
  setDubFilter: (f: DubFilter) => void
  /** Look up dub status for the loaded anime list in the background, caching as
   * it goes. `refresh` re-checks titles not yet known to be dubbed. */
  enrichDub: (refresh?: boolean) => Promise<void>
  /** Look up dub status for an explicit id list (e.g. live search results),
   * which aren't in the loaded season list. */
  enrichDubIds: (ids: number[]) => Promise<void>
  /** Ensure a single title's dub status is known (used by the detail sheet). */
  ensureDub: (id: number) => Promise<void>
}

// Token so stale responses are dropped when the user switches seasons quickly.
let requestId = 0
let controller: AbortController | null = null
let toastTimer: ReturnType<typeof setTimeout> | undefined
// Token so a background dub sweep stops when the list/season/media changes.
let dubToken = 0

export const useStore = create<StoreState>((set, get) => ({
  media: 'anime',
  season: currentSeason(),
  anime: [],
  status: 'idle',
  toast: null,

  genreIds: [],
  sort: 'score',
  query: '',

  dub: loadDubCache(),
  dubFilter: 'off',
  dubEnriching: false,

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
    // Fill in dub badges/filter for the current anime list in the background.
    if (get().media === 'anime' && get().anime.length > 0) void get().enrichDub()
  },

  refresh: async () => {
    await get().load()
    if (get().status === 'error') get().showToast('Couldn’t refresh. Try again?')
    else get().showToast(`All fresh — ${get().anime.length} titles`)
    // Re-check dubs on a manual refresh so a title that gained a dub since the
    // last look flips to dubbed.
    if (get().media === 'anime') void get().enrichDub(true)
  },

  showToast: (message) => {
    set({ toast: message })
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => set({ toast: null }), 2200)
  },

  prewarmOther: async () => {
    const { media } = get()
    try {
      // Only fetch if not already cached, and never touch the visible state.
      if (media === 'anime') {
        if (!readCache('manga')) writeCache('manga', await fetchManga())
      } else {
        if (!readCache('anime-now')) writeCache('anime-now', await fetchNow())
      }
    } catch {
      /* best-effort — ignore */
    }
  },

  setMedia: (media) => {
    if (media === get().media) return
    set({
      media,
      genreIds: [],
      query: '',
      sort: 'score',
      dubFilter: 'off',
      selected: null,
    })
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

  setDubFilter: (f) => set({ dubFilter: f }),

  enrichDub: async (refresh = false) => {
    const my = ++dubToken
    if (get().media !== 'anime') return
    const known = get().dub
    // On a refresh, re-check everything not already confirmed dubbed; otherwise
    // only look up titles whose status we don't have (cache-backed).
    const todo = get()
      .anime.map((a) => a.mal_id)
      .filter((mid) =>
        refresh
          ? known[mid] !== true
          : known[mid] === undefined && cachedDub(mid) === undefined,
      )
    if (todo.length === 0) return

    set({ dubEnriching: true })
    // AniList checks up to ~40 titles per request, so a whole season is only a
    // few calls — fast, and well under the rate limit even with a little
    // concurrency.
    const chunks: number[][] = []
    for (let i = 0; i < todo.length; i += 40) chunks.push(todo.slice(i, i + 40))
    let next = 0
    const worker = async () => {
      while (next < chunks.length && my === dubToken) {
        const map = await fetchDubBatch(chunks[next++])
        if (my !== dubToken) return
        const entries = Object.entries(map)
        if (entries.length > 0)
          set((s) => {
            const dub = { ...s.dub }
            for (const [id, v] of entries) dub[+id] = v
            return { dub }
          })
      }
    }
    await Promise.all(Array.from({ length: 3 }, worker))
    if (my === dubToken) set({ dubEnriching: false })
  },

  enrichDubIds: async (ids) => {
    if (get().media !== 'anime' || ids.length === 0) return
    const known = get().dub
    // Fill in any statuses already cached but not yet in the map (instant).
    const fromCache: Record<number, boolean> = {}
    for (const mid of ids) {
      if (known[mid] !== undefined) continue
      const c = cachedDub(mid)
      if (c !== undefined) fromCache[mid] = c
    }
    if (Object.keys(fromCache).length > 0)
      set((s) => ({ dub: { ...s.dub, ...fromCache } }))
    // Look up the rest from AniList, batched.
    const todo = ids.filter(
      (mid) =>
        get().dub[mid] === undefined &&
        known[mid] === undefined &&
        cachedDub(mid) === undefined,
    )
    for (let i = 0; i < todo.length; i += 40) {
      const map = await fetchDubBatch(todo.slice(i, i + 40))
      const entries = Object.entries(map)
      if (entries.length > 0)
        set((s) => {
          const dub = { ...s.dub }
          for (const [id, v] of entries) dub[+id] = v
          return { dub }
        })
    }
  },

  ensureDub: async (id) => {
    if (get().dub[id] !== undefined) return
    const c = cachedDub(id)
    if (c !== undefined) {
      set((s) => ({ dub: { ...s.dub, [id]: c } }))
      return
    }
    const map = await fetchDubBatch([id])
    if (id in map) set((s) => ({ dub: { ...s.dub, [id]: map[id] } }))
  },
}))
