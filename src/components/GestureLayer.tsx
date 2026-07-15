import { useEffect, useRef } from 'react'

import { usePrefs } from '@/store/usePrefs'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

/**
 * Touch shortcuts + the bottom scrim that hints at them (off while a sheet is
 * open):
 *   • Double-tap the bottom strip → cycle For You ↔ All. The strip captures
 *     taps (so cards underneath aren't hit) but allows vertical scrolling.
 *   • Fast flick downward in the top 20% → focus the search bar.
 */
export function GestureLayer({ disabled }: { disabled: boolean }) {
  const forYou = usePrefs((s) => s.forYou)
  const toggleForYou = usePrefs((s) => s.toggleForYou)
  const canForYou = usePrefs((s) => s.genres.length > 0 || s.starred.length > 0)
  const clearGenres = useStore((s) => s.clearGenres)
  const showToast = useStore((s) => s.showToast)

  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  // --- Bottom strip: double-tap cycles For You <-> All ---------------------
  const lastTap = useRef(0)
  const cycle = () => {
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
  const onZoneClick = (e: React.MouseEvent) => {
    const now = e.timeStamp
    if (now - lastTap.current < 340) {
      lastTap.current = 0
      cycle()
    } else {
      lastTap.current = now
    }
  }

  // --- Top flick → search (window-level so it works over any content) ------
  useEffect(() => {
    let pts: { x: number; y: number; t: number }[] = []
    let tracking = false

    const onStart = (e: TouchEvent) => {
      if (disabledRef.current) {
        tracking = false
        return
      }
      const t = e.touches[0]
      pts = [{ x: t.clientX, y: t.clientY, t: performance.now() }]
      tracking = true
    }
    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const t = e.touches[0]
      pts.push({ x: t.clientX, y: t.clientY, t: performance.now() })
      if (pts.length > 400) pts.shift()
    }
    const onEnd = () => {
      if (!tracking) return
      tracking = false
      if (pts.length === 0) return
      const first = pts[0]
      const last = pts[pts.length - 1]
      const dx = last.x - first.x
      const dy = last.y - first.y
      const dur = last.t - first.t
      const velocity = dy / Math.max(1, dur) // px per ms

      // Fast downward flick in the top 20% → focus search. Velocity gate keeps a
      // slow hold-and-pull (pull-to-refresh) from triggering it.
      if (
        first.y < window.innerHeight * 0.2 &&
        dy > 90 &&
        Math.abs(dx) < dy * 0.6 &&
        dur < 300 &&
        velocity > 0.6
      ) {
        const el = document.getElementById(
          'app-search',
        ) as HTMLInputElement | null
        if (!el) return
        if (document.activeElement === el) {
          el.blur()
          el.focus()
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' })
          el.focus()
        }
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    window.addEventListener('touchcancel', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  // Bottom strip: captures taps (cards underneath stay untouched) but permits
  // vertical scrolling via touch-action. Mobile only; fades out with a sheet.
  return (
    <div
      aria-hidden
      onClick={onZoneClick}
      style={{ touchAction: 'pan-y' }}
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 h-[10vh] bg-gradient-to-t from-ink via-ink/45 to-transparent transition-opacity duration-300 [@media(pointer:fine)]:hidden',
        disabled ? 'pointer-events-none opacity-0' : 'opacity-100',
      )}
    />
  )
}
