import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PrefsState {
  /** Has the user completed (or skipped) the first-run taste quiz? */
  onboarded: boolean
  /** Favorite genre/theme names, matched against each anime's tags. */
  genres: string[]
  /** Whether the grid is currently filtered to "For You" (taste + starred). */
  forYou: boolean
  /** Starred titles as `${media}:${mal_id}` keys (persisted watchlist). */
  starred: string[]

  completeOnboarding: (genres: string[]) => void
  setGenres: (genres: string[]) => void
  toggleForYou: () => void
  redoQuiz: () => void
  toggleStar: (key: string) => void
  clearStars: () => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      onboarded: false,
      genres: [],
      forYou: false,
      starred: [],

      completeOnboarding: (genres) =>
        set({ genres, onboarded: true, forYou: genres.length > 0 }),
      setGenres: (genres) => set({ genres }),
      toggleForYou: () => set((s) => ({ forYou: !s.forYou })),
      redoQuiz: () => set({ onboarded: false }),
      toggleStar: (key) =>
        set((s) => ({
          starred: s.starred.includes(key)
            ? s.starred.filter((k) => k !== key)
            : [...s.starred, key],
        })),
      clearStars: () => set({ starred: [] }),
    }),
    { name: 'lazymal-prefs' },
  ),
)
