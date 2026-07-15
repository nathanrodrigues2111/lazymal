import { usePrefs } from '@/store/usePrefs'
import { useStore } from '@/store/useStore'
import { SORT_LABELS } from '@/lib/filter'
import type { SortKey } from '@/lib/types'
import { cn } from '@/lib/utils'

const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[]

/**
 * Mobile bottom bar (a soft gradient scrim, off while a sheet is open) split
 * into three invisible tap zones:
 *   • Left   → cycle For You ↔ All
 *   • Center → Search
 *   • Right  → cycle the sort (airing soon, top rated, …)
 * Zones capture taps so cards underneath aren't hit; `touch-action: pan-y`
 * still lets you scroll through it.
 */
export function GestureLayer({ disabled }: { disabled: boolean }) {
  const forYou = usePrefs((s) => s.forYou)
  const toggleForYou = usePrefs((s) => s.toggleForYou)
  const canForYou = usePrefs((s) => s.genres.length > 0 || s.starred.length > 0)
  const clearGenres = useStore((s) => s.clearGenres)
  const sort = useStore((s) => s.sort)
  const setSort = useStore((s) => s.setSort)
  const showToast = useStore((s) => s.showToast)

  const cycleForYou = () => {
    if (forYou) {
      clearGenres()
      toggleForYou()
      showToast('All')
    } else if (!canForYou) {
      showToast('Star a title to unlock For You')
    } else {
      toggleForYou()
      showToast('For You ✨')
    }
  }

  const openSearch = () => {
    const el = document.getElementById('app-search') as HTMLInputElement | null
    window.scrollTo({ top: 0, behavior: 'smooth' })
    el?.focus()
  }

  const cycleSort = () => {
    const i = SORT_KEYS.indexOf(sort)
    const next = SORT_KEYS[(i + 1) % SORT_KEYS.length]
    setSort(next)
    showToast(SORT_LABELS[next])
  }

  const zone = 'touch-pan-y'

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 grid h-[8vh] grid-cols-3 bg-gradient-to-t from-ink via-ink/40 to-transparent transition-opacity duration-300 [@media(pointer:fine)]:hidden',
        disabled ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
    >
      <button
        type="button"
        aria-label="Cycle For You and All"
        onClick={cycleForYou}
        className={zone}
      />
      <button
        type="button"
        aria-label="Search"
        onClick={openSearch}
        className={zone}
      />
      <button
        type="button"
        aria-label="Cycle sort order"
        onClick={cycleSort}
        className={zone}
      />
    </div>
  )
}
