import { useEffect, useRef } from 'react'

import { usePrefs } from '@/store/usePrefs'
import { useStore } from '@/store/useStore'

/**
 * One-finger gesture shortcuts (touch only, off while a sheet is open):
 *   • Diagonal from the right side down to bottom-left → For You.
 *   • Diagonal from the left side down to bottom-right → All.
 *   • Quick flick downward in the top 30% → focus the search bar.
 * All gated on direction/speed/start-region so they aren't confused with
 * scrolling or the horizontal media swipe.
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
      if (pts.length < 4) return

      const first = pts[0]
      const last = pts[pts.length - 1]
      const dx = last.x - first.x // - = leftward
      const dy = last.y - first.y // + = downward
      const dur = last.t - first.t
      const ratio = Math.abs(dx) / Math.max(1, Math.abs(dy))

      // Diagonal band: clearly slanted (not a vertical scroll, not the more
      // horizontal media swipe which needs ratio > 1.6). Direction decides which.
      const diagonal = dy > 80 && ratio > 0.5 && ratio < 1.5

      // Down-left → For You.
      if (diagonal && dx < 0) {
        openForYou()
        return
      }

      // Down-right → All.
      if (diagonal && dx > 0) {
        openAll()
        return
      }

      // --- Quick downward flick (top 30%) → search -------------------------
      if (
        first.y < window.innerHeight * 0.3 &&
        dy > 110 &&
        Math.abs(dx) < dy * 0.6 &&
        dur < 400
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
  }, [toggleForYou, showToast])

  return null
}
