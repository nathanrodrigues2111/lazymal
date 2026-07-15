import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'

import { useStore } from '@/store/useStore'

/**
 * Floating close button shown while search is active (focused or has a query).
 * Tapping it clears the query and dismisses the field. It rides above the
 * on-screen keyboard using the visualViewport API, and springs in/out.
 */
export function SearchClose() {
  const query = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const [focused, setFocused] = useState(false)
  const [kb, setKb] = useState(0)
  const kbOpenRef = useRef(false)

  // Track focus on the search input.
  useEffect(() => {
    const el = document.getElementById('app-search')
    if (!el) return
    const onFocus = () => setFocused(true)
    const onBlur = () => setFocused(false)
    el.addEventListener('focus', onFocus)
    el.addEventListener('blur', onBlur)
    return () => {
      el.removeEventListener('focus', onFocus)
      el.removeEventListener('blur', onBlur)
    }
  }, [])

  // Lift the button above the keyboard when it's open, and drop the search
  // highlight (blur) the moment the keyboard is dismissed.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKb(offset)
      const open = offset > 120
      if (kbOpenRef.current && !open) {
        const el = document.getElementById(
          'app-search',
        ) as HTMLInputElement | null
        if (el && document.activeElement === el) el.blur()
      }
      kbOpenRef.current = open
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  const visible = focused || query.trim() !== ''

  const close = () => {
    setQuery('')
    const el = document.getElementById('app-search') as HTMLInputElement | null
    el?.blur()
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={close}
          aria-label="Close search"
          initial={{ opacity: 0, y: 24, scale: 0.5, x: '-50%' }}
          animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
          exit={{ opacity: 0, y: 24, scale: 0.5, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.6 }}
          style={{ bottom: `calc(env(safe-area-inset-bottom) + 1.25rem + ${kb}px)` }}
          className="fixed left-1/2 z-50 grid size-14 place-items-center rounded-full bg-brand text-white shadow-2xl shadow-brand/40 transition-colors active:brightness-95 [@media(pointer:fine)]:hidden"
        >
          <X className="size-6" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
