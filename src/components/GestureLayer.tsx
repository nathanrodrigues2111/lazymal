import { usePrefs } from '@/store/usePrefs'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

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
  const canForYou = usePrefs((s) => s.genres.length > 0 || s.starred.length > 0)
  const clearGenres = useStore((s) => s.clearGenres)
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

  const openSort = () => {
    // Reuse the real sort button so the actual dropdown opens — no toast to
    // squint at.
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const btn = document.querySelector(
      '[data-tour="sort"] button',
    ) as HTMLButtonElement | null
    btn?.click()
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
