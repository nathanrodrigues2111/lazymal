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

  completeOnboarding: (genres: string[]) => void
  setGenres: (genres: string[]) => void
  toggleForYou: () => void
  redoQuiz: () => void
  toggleStar: (media: Media, item: Anime) => void
  clearStars: () => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      onboarded: false,
      genres: [],
      forYou: false,
      starred: [],
      starredItems: {},

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
    }),
    { name: 'lazymal-prefs' },
  ),
)
