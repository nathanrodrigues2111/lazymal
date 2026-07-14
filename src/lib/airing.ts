import type { Anime } from './types'

const DAYS = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
]

const JST_OFFSET_MS = 9 * 3600 * 1000 // Japan has no DST, so a fixed +9 is exact.

/**
 * Compute the next air datetime from an anime's broadcast schedule (day + time
 * in JST). Returns a local Date for the soonest upcoming episode, or null if
 * the broadcast info is missing/irregular.
 */
export function nextAiring(anime: Anime): Date | null {
  const bc = anime.broadcast
  if (!anime.airing || !bc?.day || !bc.time) return null
  const targetDow = DAYS.indexOf(bc.day)
  if (targetDow < 0) return null
  const [th, tm] = bc.time.split(':').map(Number)
  if (Number.isNaN(th)) return null

  const now = new Date()
  // Represent "now" as JST wall-clock by reading UTC methods on a +9h-shifted date.
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS)
  const days = (targetDow - jstNow.getUTCDay() + 7) % 7

  // Build the candidate JST wall time (as a UTC-encoded instant).
  const cand = new Date(
    Date.UTC(
      jstNow.getUTCFullYear(),
      jstNow.getUTCMonth(),
      jstNow.getUTCDate() + days,
      th,
      tm || 0,
      0,
    ),
  )
  if (days === 0 && cand.getTime() <= jstNow.getTime())
    cand.setUTCDate(cand.getUTCDate() + 7)

  // Convert the JST wall time back to a real UTC instant.
  return new Date(cand.getTime() - JST_OFFSET_MS)
}

/** Short relative countdown, e.g. "2d 4h", "3h 12m", "just now". */
export function countdown(date: Date, from = new Date()): string {
  const ms = date.getTime() - from.getTime()
  if (ms <= 0) return 'now'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** The user's local weekday + time for the given date, e.g. "Sun 23:30". */
export function localAirLabel(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
