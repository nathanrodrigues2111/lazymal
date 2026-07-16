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
 *   • Right  → open the sort menu
 * Zones capture taps so cards underneath aren't hit; `touch-action: pan-y`
 * still lets you scroll through it.
 */
export function GestureLayer({ disabled }: { disabled: boolean }) {
  const forYou = usePrefs((s) => s.forYou)
  const toggleForYou = usePrefs((s) => s.toggleForYou)
  const clearGenres = useStore((s) => s.clearGenres)
  const media = useStore((s) => s.media)
  const sort = useStore((s) => s.sort)
  const setSort = useStore((s) => s.setSort)
  const dubFilter = useStore((s) => s.dubFilter)
  const setDubFilter = useStore((s) => s.setDubFilter)

  const cycleForYou = () => {
    if (forYou) clearGenres() // going For You -> All
    toggleForYou()
  }

  // The dropdown's combined single-select order: the sort keys, with "Dubbed"
  // (anime only) inserted just before A–Z. Cycling the bottom-right zone walks
  // this exact list so it can land on Dubbed too.
  type View = SortKey | 'dubbed'
  const views: View[] = []
  for (const k of SORT_KEYS) {
    if (k === 'title' && media === 'anime') views.push('dubbed')
    views.push(k)
  }
  const currentView: View = dubFilter === 'dubbed' ? 'dubbed' : sort
  const applyView = (v: View) => {
    if (v === 'dubbed') {
      setDubFilter('dubbed')
      setSort('score')
    } else {
      setSort(v)
      setDubFilter('off')
    }
  }

  const sortBtn = () =>
    document.querySelector('[data-tour="sort"] button') as HTMLButtonElement | null

  const openSearch = () => {
    // Close the sort menu if it's open — search and sort aren't both active.
    if (document.querySelector('[data-sort-menu]')) sortBtn()?.click()
    const el = document.getElementById('app-search') as HTMLInputElement | null
    window.scrollTo({ top: 0, behavior: 'smooth' })
    el?.focus()
  }

  const openSort = () => {
    // If the sort menu is already open, advance the selection through the list
    // (menu stays open so you watch the highlight move). Otherwise, open it.
    if (document.querySelector('[data-sort-menu]')) {
      const i = views.indexOf(currentView)
      applyView(views[(i + 1) % views.length])
      return
    }
    // Opening the menu — dismiss any active search first.
    const search = document.getElementById(
      'app-search',
    ) as HTMLInputElement | null
    if (search && document.activeElement === search) search.blur()
    sortBtn()?.click()
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
        aria-label="Open sort menu"
        onClick={openSort}
        className={zone}
      />
    </div>
  )
}
