import type { Season, SeasonName } from './types'

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
