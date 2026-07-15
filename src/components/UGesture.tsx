import { useEffect, useRef } from 'react'

import { usePrefs } from '@/store/usePrefs'
import { useStore } from '@/store/useStore'

/**
 * Draw a "U" with one finger (down, then back up) to jump to the For You tab.
 * Kept deliberately strict — both arms must be long, roughly vertical, return
 * near the start, and happen quickly — so it isn't tripped by normal scrolling.
 * Touch only; disabled while a sheet/modal is open.
 */
export function UGesture({ disabled }: { disabled: boolean }) {
  const forYou = usePrefs((s) => s.forYou)
  const toggleForYou = usePrefs((s) => s.toggleForYou)
  const canForYou = usePrefs(
    (s) => s.genres.length > 0 || s.starred.length > 0,
  )
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
      if (pts.length > 300) pts.shift()
    }

    const onEnd = () => {
      if (!tracking) return
      tracking = false
      if (pts.length < 6) return

      const xs = pts.map((p) => p.x)
      const ys = pts.map((p) => p.y)
      const startY = ys[0]
      const endY = ys[ys.length - 1]
      const maxY = Math.max(...ys) // lowest point of the U
      const valleyIdx = ys.indexOf(maxY)
      const down = maxY - startY // downstroke length
      const up = maxY - endY // upstroke length
      const horiz = Math.max(...xs) - Math.min(...xs)
      const dur = pts[pts.length - 1].t - pts[0].t

      const isU =
        down > 120 &&
        up > 120 &&
        Math.abs(endY - startY) < 90 && // returns near the start height
        valleyIdx > 2 &&
        valleyIdx < pts.length - 3 && // valley sits in the middle
        horiz < Math.max(down, up) * 0.8 && // mostly vertical
        dur < 1200 // deliberate, not a slow scroll

      if (!isU) return
      if (!canForYouRef.current) {
        showToast('Star a title to unlock For You')
        return
      }
      if (!forYouRef.current) toggleForYou()
      showToast('For You ✨')
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
