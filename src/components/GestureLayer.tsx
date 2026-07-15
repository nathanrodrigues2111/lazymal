import { Search, Sparkles, SlidersHorizontal } from 'lucide-react'

import { usePrefs } from '@/store/usePrefs'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

/**
 * Mobile bottom bar (a soft gradient scrim, off while a sheet is open) split
 * into three tap zones:
 *   • Left   → For You
 *   • Center → Search
 *   • Right  → Filter (jump to the genre chips)
 * It captures taps so cards underneath aren't hit, but `touch-action: pan-y`
 * still lets you scroll through it.
 */
export function GestureLayer({ disabled }: { disabled: boolean }) {
  const forYou = usePrefs((s) => s.forYou)
  const toggleForYou = usePrefs((s) => s.toggleForYou)
  const canForYou = usePrefs((s) => s.genres.length > 0 || s.starred.length > 0)
  const showToast = useStore((s) => s.showToast)

  const openForYou = () => {
    if (!canForYou) {
      showToast('Star a title to unlock For You')
      return
    }
    if (!forYou) toggleForYou()
    showToast('For You ✨')
  }

  const openSearch = () => {
    const el = document.getElementById('app-search') as HTMLInputElement | null
    window.scrollTo({ top: 0, behavior: 'smooth' })
    el?.focus()
  }

  const openFilter = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    showToast('Filter')
  }

  const zone =
    'flex touch-pan-y flex-col items-center justify-end gap-0.5 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] text-muted-foreground/80 transition-colors active:text-foreground'
  const label = 'text-[10px] font-semibold'

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 grid h-[8vh] grid-cols-3 bg-gradient-to-t from-ink via-ink/40 to-transparent transition-opacity duration-300 [@media(pointer:fine)]:hidden',
        disabled ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
    >
      <button type="button" onClick={openForYou} aria-label="For You" className={zone}>
        <Sparkles className="size-4" />
        <span className={label}>For You</span>
      </button>
      <button type="button" onClick={openSearch} aria-label="Search" className={zone}>
        <Search className="size-4" />
        <span className={label}>Search</span>
      </button>
      <button type="button" onClick={openFilter} aria-label="Filter" className={zone}>
        <SlidersHorizontal className="size-4" />
        <span className={label}>Filter</span>
      </button>
    </div>
  )
}
