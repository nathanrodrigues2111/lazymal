import { motion } from 'motion/react'
import { Sparkles, X } from 'lucide-react'

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

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
      {(favorites.length > 0 || hasStarred) && (
        <Chip active={forYou} onClick={toggleForYou} className="gap-1">
          <Sparkles className="size-3" />
          For You
        </Chip>
      )}
      <Chip
        active={genreIds.length === 0 && !forYou}
        onClick={() => {
          clearGenres()
          if (forYou) toggleForYou()
        }}
      >
        All
      </Chip>
      {genreIds.length > 0 && (
        <Chip active onClick={clearGenres} className="text-primary">
          Clear <X className="size-3" />
        </Chip>
      )}
      {genres.map((g) => (
        <Chip
          key={g.mal_id}
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
  className,
  children,
}: {
  active: boolean
  onClick: () => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={cn(
        'flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
        active
          ? 'border-primary bg-primary/15 text-primary'
          : 'border-line bg-panel-2 text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {children}
    </motion.button>
  )
}
