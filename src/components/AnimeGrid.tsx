import { useMemo } from 'react'

import { useStore } from '@/store/useStore'
import { usePrefs } from '@/store/usePrefs'
import { deriveGenres, filterAndSort, isMatch } from '@/lib/filter'
import { AnimeCard } from '@/components/AnimeCard'
import { GenreFilter } from '@/components/GenreFilter'
import { CryingGirl } from '@/components/CryingGirl'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

export function AnimeGrid() {
  const anime = useStore((s) => s.anime)
  const status = useStore((s) => s.status)
  const genreIds = useStore((s) => s.genreIds)
  const sort = useStore((s) => s.sort)
  const query = useStore((s) => s.query)
  const select = useStore((s) => s.select)
  const load = useStore((s) => s.load)
  const favorites = usePrefs((s) => s.genres)
  const forYou = usePrefs((s) => s.forYou)

  const genres = useMemo(() => deriveGenres(anime), [anime])
  const visible = useMemo(
    () => filterAndSort(anime, genreIds, sort, query, favorites, forYou),
    [anime, genreIds, sort, query, favorites, forYou],
  )

  if (status === 'loading') return <GridSkeleton />

  if (status === 'error') {
    return (
      <Empty
        crying
        title="Mou~ it won't load…"
        body="MyAnimeList is being sleepy right now. Give it a sec and poke it again!"
        action={
          <Button onClick={() => load()} className="rounded-full">
            Try again
          </Button>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <GenreFilter genres={genres} />

      {visible.length === 0 ? (
        <Empty
          crying={false}
          title="Nothing here~"
          body="No anime match those filters. Try clearing them or searching something else!"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
          {visible.map((a, i) => (
            <AnimeCard
              key={a.mal_id}
              anime={a}
              index={i}
              matched={!forYou && favorites.length > 0 && isMatch(a, favorites)}
              onSelect={select}
            />
          ))}
        </div>
      )}

      {visible.length > 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          {visible.length} titles this season 🌸
        </p>
      )}
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-7 w-16 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[2/3] w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}

function Empty({
  crying,
  title,
  body,
  action,
}: {
  crying: boolean
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <CryingGirl crying={crying} className="size-28 drop-shadow-[0_8px_24px_rgba(255,77,109,0.25)]" />
      <div>
        <p className="font-display text-lg font-bold text-foreground">
          {title}
        </p>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  )
}
