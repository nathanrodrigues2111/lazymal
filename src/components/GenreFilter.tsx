import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronRight, Sparkles } from 'lucide-react'

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
  const favorites = usePrefs((s) => s.genres)
  const forYou = usePrefs((s) => s.forYou)
  const toggleForYou = usePrefs((s) => s.toggleForYou)
  const hasStarred = usePrefs((s) => s.starred.length > 0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const [canRight, setCanRight] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () =>
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [genres, media])

  if (genres.length === 0) return null

  return (
    <div className="relative">
      <motion.div
        ref={scrollRef}
        // Re-key on media so the stagger replays when switching Anime/Manga.
        key={media}
        variants={CONTAINER}
        initial="hidden"
        animate="show"
        className="no-scrollbar flex scroll-smooth gap-2 overflow-x-auto pb-1"
      >
        {(favorites.length > 0 || hasStarred) && (
          <Chip active={forYou} onClick={toggleForYou}>
            <Sparkles className="size-3" />
            For You
          </Chip>
        )}
        {/* "All" clears any genre selection and For You. */}
        <Chip
          active={genreIds.length === 0 && !forYou}
          onClick={() => {
            clearGenres()
            if (forYou) toggleForYou()
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

      {/* Desktop-only (fine pointer) scroll affordance — touch devices swipe. */}
      {canRight && (
        <button
          type="button"
          aria-label="Scroll genres right"
          onClick={() =>
            scrollRef.current?.scrollBy({ left: 240, behavior: 'smooth' })
          }
          className="absolute bottom-1 right-0 top-0 hidden items-center bg-gradient-to-l from-ink via-ink pl-8 pr-0.5 [@media(pointer:fine)]:flex"
        >
          <span className="grid size-7 place-items-center rounded-full border border-line bg-panel-2 text-muted-foreground transition-colors hover:border-brand/50 hover:text-foreground">
            <ChevronRight className="size-4" />
          </span>
        </button>
      )}
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
