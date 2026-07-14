import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PrefsState {
  /** Has the user completed (or skipped) the first-run taste quiz? */
  onboarded: boolean
  /** Favorite genre/theme names, matched against each anime's tags. */
  genres: string[]
  /** Whether the grid is currently filtered to "For You" matches only. */
  forYou: boolean

  completeOnboarding: (genres: string[]) => void
  setGenres: (genres: string[]) => void
  toggleForYou: () => void
  redoQuiz: () => void
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      onboarded: false,
      genres: [],
      forYou: false,

      completeOnboarding: (genres) =>
        set({ genres, onboarded: true, forYou: genres.length > 0 }),
      setGenres: (genres) => set({ genres }),
      toggleForYou: () => set((s) => ({ forYou: !s.forYou })),
      redoQuiz: () => set({ onboarded: false }),
    }),
    { name: 'lazymal-prefs' },
  ),
)
