import { useEffect, useRef } from 'react'

/**
 * Draw a circle with one finger, anywhere, to jump to and focus the search bar.
 * A loop is unmistakable — unlike a swipe it can't be confused with scrolling —
 * so there are no gesture conflicts. Touch only; off while a sheet is open.
 */
export function SearchGesture({ disabled }: { disabled: boolean }) {
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  useEffect(() => {
    let pts: { x: number; y: number }[] = []
    let tracking = false

    const onStart = (e: TouchEvent) => {
      if (disabledRef.current) {
        tracking = false
        return
      }
      const t = e.touches[0]
      pts = [{ x: t.clientX, y: t.clientY }]
      tracking = true
    }

    const onMove = (e: TouchEvent) => {
      if (!tracking) return
      const t = e.touches[0]
      pts.push({ x: t.clientX, y: t.clientY })
      if (pts.length > 400) pts.shift()
    }

    const onEnd = () => {
      if (!tracking) return
      tracking = false
      if (pts.length < 12) return

      const xs = pts.map((p) => p.x)
      const ys = pts.map((p) => p.y)
      const w = Math.max(...xs) - Math.min(...xs)
      const h = Math.max(...ys) - Math.min(...ys)

      // Must enclose a real, roughly round area — rules out lines/swipes.
      if (w < 60 || h < 60) return
      if (Math.min(w, h) / Math.max(w, h) < 0.45) return

      // Sum the turning angle around the centroid; a full loop ≈ 2π.
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
      if (Math.abs(total) < 5.0) return // ~290°+ of sweep required

      const el = document.getElementById('app-search') as HTMLInputElement | null
      if (!el) return
      window.scrollTo({ top: 0, behavior: 'smooth' })
      el.focus()
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

  return null
}
