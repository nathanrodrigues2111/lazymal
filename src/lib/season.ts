import type { Season, SeasonName } from './types'

export const SEASON_ORDER: SeasonName[] = ['winter', 'spring', 'summer', 'fall']

const SEASON_EMOJI: Record<SeasonName, string> = {
  winter: '❄️',
  spring: '🌸',
  summer: '☀️',
  fall: '🍁',
}

/** Map a month (0-indexed) to its anime season. */
function seasonForMonth(month: number): SeasonName {
  if (month <= 2) return 'winter' // Jan–Mar
  if (month <= 5) return 'spring' // Apr–Jun
  if (month <= 8) return 'summer' // Jul–Sep
  return 'fall' // Oct–Dec
}

export function currentSeason(now = new Date()): Season {
  return { year: now.getFullYear(), season: seasonForMonth(now.getMonth()) }
}

export function seasonEmoji(season: SeasonName): string {
  return SEASON_EMOJI[season]
}

export function seasonLabel({ year, season }: Season): string {
  return `${season[0].toUpperCase()}${season.slice(1)} ${year}`
}

/** Step a season forward (+1) or backward (-1), rolling the year over. */
export function shiftSeason({ year, season }: Season, delta: number): Season {
  const total = SEASON_ORDER.indexOf(season) + delta
  const yearShift = Math.floor(total / 4)
  const idx = ((total % 4) + 4) % 4
  return { year: year + yearShift, season: SEASON_ORDER[idx] }
}

export function sameSeason(a: Season, b: Season): boolean {
  return a.year === b.year && a.season === b.season
}

/** Is this season after `ref` (default: the current season)? */
export function isFuture(season: Season, ref = currentSeason()): boolean {
  if (season.year !== ref.year) return season.year > ref.year
  return SEASON_ORDER.indexOf(season.season) > SEASON_ORDER.indexOf(ref.season)
}
