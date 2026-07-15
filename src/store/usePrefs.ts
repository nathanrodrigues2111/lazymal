import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Anime, Media } from '../lib/types'

export interface StarredEntry {
  media: Media
  item: Anime
}

interface PrefsState {
  /** Has the user completed (or skipped) the first-run taste quiz? */
  onboarded: boolean
  /** Favorite genre/theme names, matched against each anime's tags. */
  genres: string[]
  /** Whether the grid is currently filtered to "For You" (taste + starred). */
  forYou: boolean
  /** Starred keys `${media}:${mal_id}` for quick membership checks. */
  starred: string[]
  /** Full starred items so favorites (incl. searched ones) show in For You
   * even when they're not in the current season/airing list. */
  starredItems: Record<string, StarredEntry>
  /** User-chosen order of the watch/read sources, by source name, per media.
   * Empty = use the natural (built-in) order. */
  sourceOrder: Record<Media, string[]>
  /** Source names the user has hidden from the launcher, per media. */
  hiddenSources: Record<Media, string[]>
  /** Has the user seen (or dismissed) the first-run feature tour? */
  toured: boolean

  completeOnboarding: (genres: string[]) => void
  setGenres: (genres: string[]) => void
  toggleForYou: () => void
  redoQuiz: () => void
  toggleStar: (media: Media, item: Anime) => void
  clearStars: () => void
  setSourceOrder: (media: Media, order: string[]) => void
  toggleSourceHidden: (media: Media, name: string) => void
  completeTour: () => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      // Default to onboarded so the first-run quiz never auto-pops — taste is
      // set from Settings instead. redoQuiz() can still surface it on demand.
      onboarded: true,
      genres: [],
      forYou: false,
      starred: [],
      starredItems: {},
      sourceOrder: { anime: [], manga: [] },
      hiddenSources: { anime: [], manga: [] },
      toured: false,

      completeOnboarding: (genres) =>
        set({ genres, onboarded: true, forYou: genres.length > 0 }),
      setGenres: (genres) => set({ genres }),
      toggleForYou: () => set((s) => ({ forYou: !s.forYou })),
      redoQuiz: () => set({ onboarded: false }),
      toggleStar: (media, item) =>
        set((s) => {
          const key = `${media}:${item.mal_id}`
          const on = s.starred.includes(key)
          const items = { ...s.starredItems }
          if (on) delete items[key]
          else items[key] = { media, item }
          return {
            starred: on
              ? s.starred.filter((k) => k !== key)
              : [...s.starred, key],
            starredItems: items,
          }
        }),
      clearStars: () => set({ starred: [], starredItems: {} }),
      setSourceOrder: (media, order) =>
        set((s) => ({ sourceOrder: { ...s.sourceOrder, [media]: order } })),
      toggleSourceHidden: (media, name) =>
        set((s) => {
          const cur = s.hiddenSources[media]
          const next = cur.includes(name)
            ? cur.filter((n) => n !== name)
            : [...cur, name]
          return { hiddenSources: { ...s.hiddenSources, [media]: next } }
        }),
      completeTour: () => set({ toured: true }),
    }),
    { name: 'lazymal-prefs' },
  ),
)
