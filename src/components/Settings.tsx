import { ChevronDown, ChevronUp, GripVertical } from 'lucide-react'

import { usePrefs } from '@/store/usePrefs'
import { GenrePicker } from '@/components/GenrePicker'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import type { Media } from '@/lib/types'
import {
  READ_SOURCES,
  WATCH_SOURCES,
  orderSources,
  type WatchSource,
} from '@/lib/watch'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function Settings({ open, onOpenChange }: Props) {
  const genres = usePrefs((s) => s.genres)
  const setGenres = usePrefs((s) => s.setGenres)

  const toggle = (name: string) =>
    setGenres(
      genres.includes(name)
        ? genres.filter((g) => g !== name)
        : [...genres, name],
    )

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="overflow-y-auto overscroll-contain px-5 pb-8 pt-4">
          <DrawerTitle>Your taste~</DrawerTitle>
          <DrawerDescription className="mt-1">
            lazymal gently highlights this season’s anime that match your
            favorite genres.
          </DrawerDescription>

          <div className="mt-5">
            <GenrePicker selected={genres} onToggle={toggle} />
          </div>

          <div className="mt-8 border-t border-line/60 pt-6">
            <h3 className="font-display text-base font-bold text-foreground">
              source order~
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              arrange where-to-watch &amp; read sites however you like — this is
              the order they show up on every title.
            </p>
            <div className="mt-4 space-y-5">
              <SourceOrder
                media="anime"
                base={WATCH_SOURCES}
                label="watch (anime)"
              />
              <SourceOrder
                media="manga"
                base={READ_SOURCES}
                label="read (manga)"
              />
            </div>
          </div>

          <div className="mt-6">
            <Button
              className="w-full rounded-full"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function SourceOrder({
  media,
  base,
  label,
}: {
  media: Media
  base: WatchSource[]
  label: string
}) {
  const order = usePrefs((s) => s.sourceOrder[media])
  const setSourceOrder = usePrefs((s) => s.setSourceOrder)
  const names = orderSources(base, order).map((s) => s.name)

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= names.length) return
    const next = [...names]
    ;[next[i], next[j]] = [next[j], next[i]]
    setSourceOrder(media, next)
  }

  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <ul className="flex flex-col gap-2">
        {names.map((name, i) => (
          <li
            key={name}
            className="flex items-center gap-2 rounded-xl border border-line bg-panel-2 px-3 py-2.5"
          >
            <GripVertical className="size-4 shrink-0 text-muted-foreground/50" />
            <span className="flex-1 text-sm font-semibold text-foreground">
              {name}
            </span>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {i + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${name} up`}
                className="grid size-7 place-items-center rounded-lg border border-line bg-panel text-muted-foreground transition-colors hover:text-foreground active:scale-90 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronUp className="size-4" />
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === names.length - 1}
                aria-label={`Move ${name} down`}
                className="grid size-7 place-items-center rounded-lg border border-line bg-panel text-muted-foreground transition-colors hover:text-foreground active:scale-90 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronDown className="size-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
