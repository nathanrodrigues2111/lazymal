import { memo } from 'react'
import { BookOpen, Sparkles, Star, Tv } from 'lucide-react'

import type { Anime } from '@/lib/types'
import { useStore } from '@/store/useStore'
import { usePrefs } from '@/store/usePrefs'
import { cn } from '@/lib/utils'

interface Props {
  anime: Anime
  index: number
  matched?: boolean
  onSelect: (anime: Anime) => void
}

function AnimeCardBase({ anime, index, matched = false, onSelect }: Props) {
  const media = useStore((s) => s.media)
  const key = `${media}:${anime.mal_id}`
  const starred = usePrefs((s) => s.starred.includes(key))
  const toggleStar = usePrefs((s) => s.toggleStar)

  // Grid cards are small (2–6 columns) — the medium image is visually identical
  // at this size and roughly half the bytes/decode cost of the large one.
  const poster =
    anime.images.webp?.image_url || anime.images.jpg.image_url
  // The first row is above the fold: load it eagerly at high priority so it
  // isn't held back by lazy-loading, which improves LCP.
  const priority = index < 6
  const title = anime.title_english || anime.title
  const topGenres = anime.genres.slice(0, 2)
  const isManga = anime.publishing !== undefined || anime.chapters !== undefined
  const count = anime.episodes ?? anime.chapters

  return (
    <button
      type="button"
      onClick={() => onSelect(anime)}
      style={{
        animationDelay: `${Math.min(index * 0.025, 0.4)}s`,
        containIntrinsicSize: 'auto 360px',
      }}
      className={cn(
        'animate-rise group relative aspect-[2/3] w-full overflow-hidden rounded-2xl border bg-panel-2 text-left shadow-lg shadow-black/30 [content-visibility:auto] transition-transform active:scale-[0.97]',
        matched ? 'border-brand/70 ring-2 ring-brand/40' : 'border-line',
      )}
    >
      {/* Poster */}
      <img
        src={poster}
        alt={title}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* Readability gradient */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />

      {/* MAL score */}
      <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-xs font-bold text-white">
        <Star className="size-3 fill-yellow-400 text-yellow-400" />
        {anime.score ? anime.score.toFixed(2) : 'N/A'}
      </div>

      {/* For You badge */}
      {matched && (
        <div className="absolute left-2 top-11 flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white shadow-lg shadow-brand/30">
          <Sparkles className="size-2.5" />
          For You
        </div>
      )}

      {/* Star / favorite toggle */}
      <span
        role="button"
        aria-label={starred ? 'Remove from favorites' : 'Add to favorites'}
        onClick={(e) => {
          e.stopPropagation()
          toggleStar(media, anime)
        }}
        className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/65 transition-transform hover:scale-110 active:scale-90"
      >
        <Star
          className={cn(
            'size-4 transition-colors',
            starred ? 'fill-yellow-400 text-yellow-400' : 'text-white/80',
          )}
        />
      </span>

      {/* Title + type + genres */}
      <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-3">
        <h3 className="clamp-2 font-display text-sm font-bold leading-tight text-white">
          {title}
        </h3>
        <div className="flex flex-wrap items-center gap-1">
          {anime.type && (
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-white/90">
              {isManga ? (
                <BookOpen className="size-2.5" />
              ) : (
                <Tv className="size-2.5" />
              )}
              {anime.type}
              {count ? ` · ${count}` : ''}
            </span>
          )}
          {topGenres.map((g) => (
            <span
              key={g.mal_id}
              className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white/90"
            >
              {g.name}
            </span>
          ))}
        </div>
      </div>
    </button>
  )
}

export const AnimeCard = memo(AnimeCardBase)
