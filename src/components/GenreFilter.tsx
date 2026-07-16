import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Languages, Sparkles } from 'lucide-react'

import { useStore } from '@/store/useStore'
import { usePrefs } from '@/store/usePrefs'
import type { Genre } from '@/lib/types'
import { cn } from '@/lib/utils'

// Parent orchestrates a staggered entrance; each chip rises + fades in turn,
// mirroring the anime cards.
const CONTAINER = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035 } },
}
const CHIP = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
}

export function GenreFilter({ genres }: { genres: Genre[] }) {
  const media = useStore((s) => s.media)
  const genreIds = useStore((s) => s.genreIds)
  const toggleGenre = useStore((s) => s.toggleGenre)
  const clearGenres = useStore((s) => s.clearGenres)
  const dubFilter = useStore((s) => s.dubFilter)
  const setDubFilter = useStore((s) => s.setDubFilter)
  const favorites = usePrefs((s) => s.genres)
  const forYou = usePrefs((s) => s.forYou)
  const toggleForYou = usePrefs((s) => s.toggleForYou)
  const hasStarred = usePrefs((s) => s.starred.length > 0)

  const scrollRef = useRef<HTMLDivElement>(null)
  // 'none' = fits (no arrow); 'right' = more to scroll; 'left' = at the end,
  // so the arrow flips to send you back to the start.
  const [arrow, setArrow] = useState<'none' | 'right' | 'left'>('none')
  // Whether the row is scrolled off its start — drives the left edge fade.
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      setScrolled(el.scrollLeft > 4)
      const scrollable = el.scrollWidth > el.clientWidth + 4
      if (!scrollable) return setArrow('none')
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      setArrow(atEnd ? 'left' : 'right')
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [genres, media])

  if (genres.length === 0) return null

  const showForYou = favorites.length > 0 || hasStarred

  return (
    <div className="flex gap-2" data-tour="genres">
      {/* Pinned: only For You stays put — pinning All too ate up the row. */}
      {showForYou && (
        <motion.div
          key={`${media}-pinned`}
          variants={CONTAINER}
          initial="hidden"
          animate="show"
          className="flex shrink-0 gap-2"
        >
          <Chip active={forYou} onClick={toggleForYou}>
            <Sparkles className="size-3" />
            For You
          </Chip>
        </motion.div>
      )}

      {/* Scrollable: All + genres. */}
      <div className="relative min-w-0 flex-1">
        <motion.div
          ref={scrollRef}
          // Re-key on media so the stagger replays when switching Anime/Manga.
          key={media}
          variants={CONTAINER}
          initial="hidden"
          animate="show"
          className="no-scrollbar flex scroll-smooth gap-2 overflow-x-auto pb-1"
        >
          {/* Dub filter (anime only) — sits between For You and All, combines
              with genres, and is mutually exclusive with For You. */}
          {media === 'anime' && (
            <Chip
              active={dubFilter === 'dubbed'}
              onClick={() => {
                if (dubFilter === 'dubbed') {
                  setDubFilter('off')
                } else {
                  setDubFilter('dubbed')
                  if (forYou) toggleForYou()
                }
              }}
            >
              <Languages className="size-3" />
              Dub
            </Chip>
          )}
          {/* "All" resets everything: genres, For You, and the Dub filter. */}
          <Chip
            active={genreIds.length === 0 && !forYou && dubFilter === 'off'}
            onClick={() => {
              clearGenres()
              if (forYou) toggleForYou()
              setDubFilter('off')
            }}
          >
            All
          </Chip>
          {genres.map((g) => (
            <Chip
              key={g.mal_id}
              active={genreIds.includes(g.mal_id)}
              onClick={() => toggleGenre(g.mal_id)}
            >
              {g.name}
            </Chip>
          ))}
        </motion.div>

        {/* Left edge fade once scrolled, matching the arrow's fade. */}
        {scrolled && (
          <div className="pointer-events-none absolute bottom-0 left-0 top-0 w-8 bg-gradient-to-r from-ink to-transparent" />
        )}

        {/* Desktop-only (fine pointer) scroll affordance — touch devices swipe.
            Flips to a back arrow once you reach the end. */}
        {arrow !== 'none' && (
          <button
            type="button"
            aria-label={arrow === 'right' ? 'Scroll genres right' : 'Back to start'}
            onClick={() => {
              const el = scrollRef.current
              if (!el) return
              if (arrow === 'right') el.scrollBy({ left: 240, behavior: 'smooth' })
              else el.scrollTo({ left: 0, behavior: 'smooth' })
            }}
            className="absolute bottom-1 right-0 top-0 hidden items-center bg-gradient-to-l from-ink via-ink pl-8 pr-0.5 [@media(pointer:fine)]:flex"
          >
            <span className="grid size-7 place-items-center rounded-full border border-line bg-panel-2 text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground">
              {arrow === 'right' ? (
                <ChevronRight className="size-4" />
              ) : (
                <ChevronLeft className="size-4" />
              )}
            </span>
          </button>
        )}
      </div>
    </div>
  )
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <motion.button
      variants={CHIP}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors duration-200',
        active
          ? 'border-brand bg-brand/15 text-brand'
          : 'border-line bg-panel-2 text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </motion.button>
  )
}
