import { useEffect, useRef } from 'react'

import { usePrefs } from '@/store/usePrefs'
import { useStore } from '@/store/useStore'
import { cn } from '@/lib/utils'

/**
 * Touch shortcuts + the bottom scrim that hints at them (off while a sheet is
 * open):
 *   • Double-tap the bottom 10% of the screen → cycle For You ↔ All.
 *   • Quick flick downward in the top 40% → focus the search bar.
 * A soft black gradient marks the bottom tap zone.
 */
export function GestureLayer({ disabled }: { disabled: boolean }) {
  const forYou = usePrefs((s) => s.forYou)
  const toggleForYou = usePrefs((s) => s.toggleForYou)
  const canForYou = usePrefs((s) => s.genres.length > 0 || s.starred.length > 0)
  const clearGenres = useStore((s) => s.clearGenres)
  const showToast = useStore((s) => s.showToast)

  const forYouRef = useRef(forYou)
  forYouRef.current = forYou
  const canForYouRef = useRef(canForYou)
  canForYouRef.current = canForYou
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  useEffect(() => {
    let pts: { x: number; y: number; t: number }[] = []
    let tracking = false
    let lastTap = 0

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

    const openForYou = () => {
      if (!canForYouRef.current) {
        showToast('Star a title to unlock For You')
        return
      }
      if (!forYouRef.current) toggleForYou()
      showToast('For You ✨')
    }

    const openAll = () => {
      clearGenres()
      if (forYouRef.current) toggleForYou()
      showToast('All')
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
      const moved = Math.hypot(dx, dy)

      // Double-tap in the bottom 10% → cycle For You ↔ All.
      if (moved < 16 && dur < 260 && first.y > window.innerHeight * 0.9) {
        const now = last.t
        if (now - lastTap < 340) {
          lastTap = 0
          if (forYouRef.current) openAll()
          else openForYou()
        } else {
          lastTap = now
        }
        return
      }

      // Fast downward flick in the top 20% → focus the search bar. Requires
      // real velocity so a slow hold-and-pull (pull-to-refresh) never triggers
      // it, and a small region so it doesn't fire mid-scroll.
      const velocity = dy / Math.max(1, dur) // px per ms
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
          // Already on search — re-assert focus so a dismissed keyboard comes
          // back, without the disruptive scroll-to-top.
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
  }, [toggleForYou, clearGenres, showToast])

  // Bottom scrim marking the double-tap zone; fades out while a sheet is open.
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[18vh] bg-gradient-to-t from-ink via-ink/45 to-transparent transition-opacity duration-300 [@media(pointer:fine)]:hidden',
        disabled ? 'opacity-0' : 'opacity-100',
      )}
    />
  )
}
