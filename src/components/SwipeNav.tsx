import { useEffect, useRef } from 'react'

import { useStore } from '@/store/useStore'

const DIST = 70 // min horizontal px for a swipe
const RATIO = 1.6 // horizontal must dominate vertical by this factor

/**
 * Horizontal swipe to switch media: swipe left → Manga, right → Anime.
 * Ignores swipes that start on a horizontal scroller (genre chips) and is
 * disabled while a sheet/modal is open.
 */
export function SwipeNav({ disabled }: { disabled: boolean }) {
  const setMedia = useStore((s) => s.setMedia)
  const disabledRef = useRef(disabled)
  disabledRef.current = disabled

  useEffect(() => {
    let x0 = 0
    let y0 = 0
    let skip = false

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0]
      x0 = t.clientX
      y0 = t.clientY
      const el = e.target as Element | null
      // Don't hijack swipes on the genre chip row or inside a drawer/dialog.
      skip = !!el?.closest?.(
        '.no-scrollbar, [data-slot="drawer-content"], [role="dialog"]',
      )
    }

    const onEnd = (e: TouchEvent) => {
      if (disabledRef.current || skip) return
      const t = e.changedTouches[0]
      const dx = t.clientX - x0
      const dy = t.clientY - y0
      if (Math.abs(dx) >= DIST && Math.abs(dx) > Math.abs(dy) * RATIO) {
        window.scrollTo({ top: 0 })
        setMedia(dx < 0 ? 'manga' : 'anime')
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [setMedia])

  return null
}
