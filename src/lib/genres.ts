/**
 * Curated taste-quiz options. `name` must match the genre/theme names Jikan
 * returns so a user's picks can be matched against each anime's tags.
 */
export interface QuizGenre {
  name: string
  emoji: string
}

export const QUIZ_GENRES: QuizGenre[] = [
  { name: 'Action', emoji: '⚔️' },
  { name: 'Adventure', emoji: '🗺️' },
  { name: 'Comedy', emoji: '😂' },
  { name: 'Romance', emoji: '💕' },
  { name: 'Fantasy', emoji: '🐉' },
  { name: 'Sci-Fi', emoji: '🚀' },
  { name: 'Drama', emoji: '🎭' },
  { name: 'Slice of Life', emoji: '🍵' },
  { name: 'Mystery', emoji: '🔍' },
  { name: 'Supernatural', emoji: '👻' },
  { name: 'Horror', emoji: '💀' },
  { name: 'Sports', emoji: '⚽' },
  { name: 'Isekai', emoji: '🌀' },
  { name: 'Music', emoji: '🎵' },
  { name: 'Ecchi', emoji: '🔥' },
  { name: 'Mecha', emoji: '🤖' },
]

/** Does an anime match any of the user's favorite tags? */
export function matchScore(
  tags: { name: string }[],
  favorites: string[],
): number {
  if (favorites.length === 0) return 0
  const set = new Set(favorites)
  return tags.reduce((n, t) => (set.has(t.name) ? n + 1 : n), 0)
}
