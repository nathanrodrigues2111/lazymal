import { useEffect, useRef } from 'react'

import { usePrefs } from '@/store/usePrefs'
import { useStore } from '@/store/useStore'

/**
 * One-finger gesture shortcuts (touch only, off while a sheet is open):
 *   • Draw a circle          → jump to the For You tab.
 *   • Quick flick downward    → focus the search bar (Spotlight-style).
 * A circle can't be confused with scrolling; the search flick is gated on
 * speed + distance so it isn't tripped by ordinary scrolls.
 */
export function GestureLayer({ disabled }: { disabled: boolean }) {
  const forYou = usePrefs((s) => s.forYou)
  const toggleForYou = usePrefs((s) => s.toggleForYou)
  const canForYou = usePrefs((s) => s.genres.length > 0 || s.starred.length > 0)
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

    const focusSearch = () => {
      const el = document.getElementById('app-search') as HTMLInputElement | null
      if (!el) return
      window.scrollTo({ top: 0, behavior: 'smooth' })
      el.focus()
    }

    const openForYou = () => {
      if (!canForYouRef.current) {
        showToast('Star a title to unlock For You')
        return
      }
      if (!forYouRef.current) toggleForYou()
      showToast('For You ✨')
    }

    const onEnd = () => {
      if (!tracking) return
      tracking = false
      if (pts.length < 4) return

      const xs = pts.map((p) => p.x)
      const ys = pts.map((p) => p.y)
      const w = Math.max(...xs) - Math.min(...xs)
      const h = Math.max(...ys) - Math.min(...ys)

      // --- Circle → For You -------------------------------------------------
      if (
        pts.length >= 12 &&
        w > 60 &&
        h > 60 &&
        Math.min(w, h) / Math.max(w, h) >= 0.45
      ) {
        const cx = xs.reduce((a, b) => a + b, 0) / xs.length
        const cy = ys.reduce((a, b) => a + b, 0) / ys.length
        let total = 0
        let prev = Math.atan2(pts[0].y - cy, pts[0].x - cx)
        for (let i = 1; i < pts.length; i++) {
          let d = Math.atan2(pts[i].y - cy, pts[i].x - cx) - prev
          while (d > Math.PI) d -= 2 * Math.PI
          while (d < -Math.PI) d += 2 * Math.PI
          total += d
          prev += d
        }
        if (Math.abs(total) >= 5.0) {
          openForYou()
          return
        }
      }

      // --- Quick downward flick → search -----------------------------------
      const first = pts[0]
      const last = pts[pts.length - 1]
      const dy = last.y - first.y // + = downward
      const dx = Math.abs(last.x - first.x)
      const dur = last.t - first.t
      if (dy > 110 && dx < dy * 0.6 && dur < 400) {
        focusSearch()
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
