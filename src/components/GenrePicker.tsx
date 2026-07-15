import { m } from 'motion/react'

import { QUIZ_GENRES } from '@/lib/genres'
import { cn } from '@/lib/utils'

interface Props {
  selected: string[]
  onToggle: (name: string) => void
}

/** A grid of tappable genre chips used by both onboarding and settings. */
export function GenrePicker({ selected, onToggle }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {QUIZ_GENRES.map((g) => {
        const active = selected.includes(g.name)
        return (
          <m.button
            key={g.name}
            type="button"
            whileTap={{ scale: 0.95 }}
            onClick={() => onToggle(g.name)}
            className={cn(
              'flex h-12 items-center gap-2 rounded-2xl border px-3 text-sm font-semibold leading-tight transition-colors',
              active
                ? 'border-brand bg-brand/15 text-foreground'
                : 'border-line bg-panel-2 text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="shrink-0 text-lg leading-none">{g.emoji}</span>
            <span className="flex-1 whitespace-nowrap text-left">{g.name}</span>
          </m.button>
        )
      })}
    </div>
  )
}
