import { motion } from 'motion/react'
import { Sparkles } from 'lucide-react'

import { useStore } from '@/store/useStore'
import { usePrefs } from '@/store/usePrefs'
import type { Genre } from '@/lib/types'
import { cn } from '@/lib/utils'

export function GenreFilter({ genres }: { genres: Genre[] }) {
  const genreIds = useStore((s) => s.genreIds)
  const toggleGenre = useStore((s) => s.toggleGenre)
  const clearGenres = useStore((s) => s.clearGenres)
  const favorites = usePrefs((s) => s.genres)
  const forYou = usePrefs((s) => s.forYou)
  const toggleForYou = usePrefs((s) => s.toggleForYou)
  const hasStarred = usePrefs((s) => s.starred.length > 0)

  if (genres.length === 0) return null

  let i = 0
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {(favorites.length > 0 || hasStarred) && (
        <Chip index={i++} active={forYou} onClick={toggleForYou}>
          <Sparkles className="size-3" />
          For You
        </Chip>
      )}
      {/* "All" clears any genre selection and For You. */}
      <Chip
        index={i++}
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
          index={i++}
          active={genreIds.includes(g.mal_id)}
          onClick={() => toggleGenre(g.mal_id)}
        >
          {g.name}
        </Chip>
      ))}
    </div>
  )
}

function Chip({
  active,
  onClick,
  index,
  children,
}: {
  active: boolean
  onClick: () => void
  index: number
  children: React.ReactNode
}) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: Math.min(index * 0.02, 0.25),
        type: 'spring',
        stiffness: 500,
        damping: 30,
      }}
      whileTap={{ scale: 0.92 }}
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
