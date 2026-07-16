import { useRef } from 'react'

import { usePrefs } from '@/store/usePrefs'
import { useStore } from '@/store/useStore'
import { SORT_LABELS } from '@/lib/filter'
import type { SortKey } from '@/lib/types'
import { cn } from '@/lib/utils'

const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[]

/**
 * Mobile bottom bar (a soft gradient scrim, off while a sheet is open) split
 * into three invisible tap zones:
 *   • Left   → cycle For You → All → Dub (Dub is anime-only)
 *   • Center → Search (double-tap steps back through seasons, anime-only)
 *   • Right  → open the sort menu (tap again to advance the sort)
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
  const cycleSeason = useStore((s) => s.cycleSeason)

  // Left zone: For You → All → Dub → For You (Dub skipped for manga).
  const cycleLeft = () => {
    if (forYou) {
      // For You → All
      toggleForYou()
      clearGenres()
      setDubFilter('off')
    } else if (dubFilter === 'dubbed') {
      // Dub → For You
      setDubFilter('off')
      clearGenres()
      toggleForYou()
    } else if (media === 'anime') {
      // All → Dub
      setDubFilter('dubbed')
    } else {
      // Manga has no Dub, so All → For You
      toggleForYou()
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

  // Center zone: single tap searches; a quick second tap (anime) steps back
  // through seasons instead. A short timer distinguishes the two.
  const centerTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const centerTap = () => {
    if (centerTimer.current) {
      clearTimeout(centerTimer.current)
      centerTimer.current = undefined
      if (media === 'anime') cycleSeason()
      else openSearch()
      return
    }
    centerTimer.current = setTimeout(() => {
      centerTimer.current = undefined
      openSearch()
    }, 260)
  }

  const openSort = () => {
    // If the sort menu is already open, advance the selection through the list
    // (menu stays open so you watch the highlight move). Otherwise, open it.
    if (document.querySelector('[data-sort-menu]')) {
      const i = SORT_KEYS.indexOf(sort)
      setSort(SORT_KEYS[(i + 1) % SORT_KEYS.length])
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
        aria-label="Cycle For You, All and Dub"
        onClick={cycleLeft}
        className={zone}
      />
      <button
        type="button"
        aria-label="Search"
        onClick={centerTap}
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
