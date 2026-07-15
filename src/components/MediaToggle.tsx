import { memo } from 'react'
import { m } from 'motion/react'

import { useStore } from '@/store/useStore'
import type { Media } from '@/lib/types'
import { cn } from '@/lib/utils'

const OPTIONS: Media[] = ['anime', 'manga']

function MediaToggleBase() {
  const media = useStore((s) => s.media)
  const setMedia = useStore((s) => s.setMedia)

  const switchTo = (target: Media) => {
    if (target === media) return
    // Jump to the top so the new list starts from the beginning instead of
    // landing at a stale scroll offset.
    window.scrollTo({ top: 0 })
    setMedia(target)
  }

  return (
    <div
      data-tour="media"
      className="flex shrink-0 rounded-full border border-line bg-panel-2 p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = media === option
        return (
          <button
            key={option}
            onClick={() => switchTo(option)}
            className={cn(
              'relative rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition-colors',
              active ? 'text-white' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <m.span
                layoutId="media-pill"
                className="absolute inset-0 rounded-full bg-brand"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative z-10">{option}</span>
          </button>
        )
      })}
    </div>
  )
}

export const MediaToggle = memo(MediaToggleBase)
