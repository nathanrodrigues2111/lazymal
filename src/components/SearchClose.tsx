import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'

import { useStore } from '@/store/useStore'

/**
 * Mobile-only floating button to clear/close an active search. It only appears
 * once the keyboard is DOWN but a query is still present (so it never covers the
 * keyboard while typing). Also drops the search highlight the moment the
 * keyboard is dismissed.
 */
export function SearchClose() {
  const query = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const [kb, setKb] = useState(0)
  const kbOpenRef = useRef(false)

  useEffect(() => {
    const vv = window.visualViewport
    const update = () => {
      const offset = vv
        ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
        : 0
      setKb(offset)
      const open = offset > 80
      // The moment the keyboard closes, drop the search focus/highlight —
      // even if nothing was typed.
      if (kbOpenRef.current && !open) {
        const el = document.getElementById(
          'app-search',
        ) as HTMLInputElement | null
        el?.blur()
      }
      kbOpenRef.current = open
    }
    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  const keyboardOpen = kb > 120
  const visible = query.trim() !== '' && !keyboardOpen

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
          aria-label="Clear search"
          initial={{ opacity: 0, y: 24, scale: 0.5, x: '-50%' }}
          animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
          exit={{ opacity: 0, y: 24, scale: 0.5, x: '-50%' }}
          transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.6 }}
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
          className="fixed left-1/2 z-50 grid size-14 place-items-center rounded-full bg-brand text-white shadow-2xl shadow-brand/40 transition-colors active:brightness-95 [@media(pointer:fine)]:hidden"
        >
          <X className="size-6" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
