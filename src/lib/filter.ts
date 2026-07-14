import type { Anime, Genre, SortKey } from './types'
import { matchScore } from './genres'
import { nextAiring } from './airing'

/** Tags an anime is matched against for "For You" (genres + themes). */
export function animeTags(a: Anime): { name: string }[] {
  return [...a.genres, ...a.themes]
}

export function isMatch(a: Anime, favorites: string[]): boolean {
  return matchScore(animeTags(a), favorites) > 0
}

/** Distinct genres present in the loaded set, sorted by frequency then name. */
export function deriveGenres(anime: Anime[]): Genre[] {
  const counts = new Map<number, { genre: Genre; n: number }>()
  for (const a of anime) {
    for (const g of a.genres) {
      const entry = counts.get(g.mal_id)
      if (entry) entry.n++
      else counts.set(g.mal_id, { genre: g, n: 1 })
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || a.genre.name.localeCompare(b.genre.name))
    .map((e) => e.genre)
}

export function filterAndSort(
  anime: Anime[],
  genreIds: number[],
  sort: SortKey,
  query: string,
  favorites: string[] = [],
  forYou = false,
): Anime[] {
  const q = query.trim().toLowerCase()
  const filtered = anime.filter((a) => {
    const matchGenre =
      genreIds.length === 0 ||
      genreIds.every((id) => a.genres.some((g) => g.mal_id === id))
    if (!matchGenre) return false
    if (forYou && !isMatch(a, favorites)) return false
    if (!q) return true
    return (
      a.title.toLowerCase().includes(q) ||
      (a.title_english?.toLowerCase().includes(q) ?? false)
    )
  })

  const sorted = [...filtered]
  switch (sort) {
    case 'airing': {
      // Soonest upcoming episode first; anything without a schedule sinks.
      const at = new Map<number, number>()
      for (const a of sorted)
        at.set(a.mal_id, nextAiring(a)?.getTime() ?? Infinity)
      sorted.sort((a, b) => at.get(a.mal_id)! - at.get(b.mal_id)!)
      break
    }
    case 'score':
      sorted.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      break
    case 'popularity':
      // Lower popularity rank = more popular; 0/absent sinks to the bottom.
      sorted.sort(
        (a, b) => (a.popularity || Infinity) - (b.popularity || Infinity),
      )
      break
    case 'members':
      sorted.sort((a, b) => (b.members ?? 0) - (a.members ?? 0))
      break
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title))
      break
    case 'newest':
      sorted.sort((a, b) => b.mal_id - a.mal_id)
      break
  }

  // Surface the user's picks: stable-partition matches to the front (unless
  // we're already showing matches only).
  if (favorites.length > 0 && !forYou) {
    const matched: Anime[] = []
    const rest: Anime[] = []
    for (const a of sorted) (isMatch(a, favorites) ? matched : rest).push(a)
    return [...matched, ...rest]
  }
  return sorted
}

export const SORT_LABELS: Record<SortKey, string> = {
  airing: 'Airing soon',
  score: 'Top rated',
  popularity: 'Most popular',
  members: 'Most members',
  title: 'A–Z',
  newest: 'Newest',
}
