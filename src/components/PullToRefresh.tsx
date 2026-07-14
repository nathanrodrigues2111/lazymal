import { useEffect, useRef, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'

import { cn } from '@/lib/utils'

const THRESHOLD = 72 // px pulled before a refresh fires
const MAX = 130
const RESIST = 0.55

type Phase = 'idle' | 'drag' | 'refresh' | 'settle'

/**
 * Native-style pull-to-refresh: when scrolled to the top, dragging down
 * physically pushes the whole page down (rubber-banded). Past the threshold it
 * holds, spins, refreshes, then springs back. Touch only.
 */
export function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void>
  children: ReactNode
}) {
  const [pull, setPull] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')

  const pullRef = useRef(0)
  const phaseRef = useRef<Phase>('idle')
  const startRef = useRef<number | null>(null)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  const setPullV = (v: number) => {
    pullRef.current = v
    setPull(v)
  }
  const setPhaseV = (p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      startRef.current =
        window.scrollY <= 0 && phaseRef.current !== 'refresh'
          ? e.touches[0].clientY
          : null
    }

    const onMove = (e: TouchEvent) => {
      if (startRef.current === null || phaseRef.current === 'refresh') return
      const dy = e.touches[0].clientY - startRef.current
      if (dy > 0 && window.scrollY <= 0) {
        setPhaseV('drag')
        // Rubber-band easing — resistance grows the further you pull.
        setPullV(MAX * (1 - Math.exp((-dy * RESIST) / MAX)))
        if (pullRef.current > 4) e.preventDefault()
      } else if (dy <= 0) {
        startRef.current = null
        setPhaseV('idle')
        setPullV(0)
      }
    }

    const settleBack = () => {
      setPhaseV('settle')
      setPullV(0)
      window.setTimeout(() => {
        if (phaseRef.current === 'settle') setPhaseV('idle')
      }, 420)
    }

    const onEnd = async () => {
      if (startRef.current === null) return
      startRef.current = null
      if (pullRef.current >= THRESHOLD && phaseRef.current !== 'refresh') {
        setPhaseV('refresh')
        setPullV(THRESHOLD) // hold the page down while refreshing
        try {
          await onRefreshRef.current()
        } finally {
          settleBack()
        }
      } else {
        settleBack()
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
  const refreshing = phase === 'refresh'
  const armed = pull >= THRESHOLD
  // 1:1 while dragging; springy on release/refresh.
  const spring = 'transform 0.45s cubic-bezier(0.22,1,0.36,1)'
  const transition = phase === 'drag' ? 'none' : spring
  // Only transform while active so fixed/sticky layout is untouched at rest.
  const active = phase !== 'idle'

  return (
    <>
      {/* Spinner revealed in the gap above the pushed-down page */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center"
        style={{
          transform: `translateY(${pull - 46}px)`,
          opacity: refreshing ? 1 : progress,
          transition,
        }}
      >
        <div
          className={cn(
            'grid size-10 place-items-center rounded-full border bg-panel/90 backdrop-blur-md',
            armed || refreshing
              ? 'border-brand shadow-lg shadow-brand/30'
              : 'border-line shadow-md shadow-black/40',
          )}
          style={{ transform: `scale(${0.6 + 0.4 * progress})`, transition }}
        >
          <RefreshCw
            className={cn(
              'size-4',
              refreshing && 'animate-spin text-brand',
              !refreshing && (armed ? 'text-brand' : 'text-muted-foreground'),
            )}
            style={refreshing ? undefined : { transform: `rotate(${pull * 2.4}deg)` }}
          />
        </div>
      </div>

      <div
        style={{
          transform: active ? `translateY(${pull}px)` : undefined,
          transition,
        }}
      >
        {children}
      </div>
    </>
  )
}
