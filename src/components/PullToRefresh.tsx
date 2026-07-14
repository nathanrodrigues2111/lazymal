import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'

import { cn } from '@/lib/utils'

const THRESHOLD = 64 // px pulled before a refresh fires
const MAX = 96
const RESIST = 0.5 // drag resistance

/**
 * Pull-to-refresh: when scrolled to the top, dragging down past a threshold
 * calls `onRefresh` (which re-fetches and rewrites the cache). Touch only.
 */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const pullRef = useRef(0)
  const startRef = useRef<number | null>(null)
  const busyRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    const set = (v: number) => {
      pullRef.current = v
      setPull(v)
    }

    const onStart = (e: TouchEvent) => {
      startRef.current =
        window.scrollY <= 0 && !busyRef.current ? e.touches[0].clientY : null
    }

    const onMove = (e: TouchEvent) => {
      if (startRef.current === null || busyRef.current) return
      const dy = e.touches[0].clientY - startRef.current
      if (dy > 0 && window.scrollY <= 0) {
        set(Math.min(MAX, dy * RESIST))
        if (pullRef.current > 4) e.preventDefault() // suppress native overscroll
      } else if (dy <= 0) {
        startRef.current = null
        set(0)
      }
    }

    const onEnd = async () => {
      if (startRef.current === null) return
      startRef.current = null
      if (pullRef.current >= THRESHOLD && !busyRef.current) {
        busyRef.current = true
        setRefreshing(true)
        set(THRESHOLD)
        try {
          await onRefreshRef.current()
        } finally {
          busyRef.current = false
          setRefreshing(false)
          set(0)
        }
      } else {
        set(0)
      }
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  const progress = Math.min(1, pull / THRESHOLD)

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center"
      style={{ transform: `translateY(${pull}px)`, opacity: progress }}
    >
      <div className="mt-2 grid size-9 place-items-center rounded-full border border-line bg-panel shadow-lg shadow-black/40">
        <RefreshCw
          className={cn('size-4 text-brand', refreshing && 'animate-spin')}
          style={
            refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }
          }
        />
      </div>
    </div>
  )
}
