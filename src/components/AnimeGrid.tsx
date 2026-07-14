import { useEffect, useMemo, useState } from 'react'

import { useStore } from '@/store/useStore'
import { usePrefs } from '@/store/usePrefs'
import { deriveGenres, filterAndSort, isMatch } from '@/lib/filter'
import { searchTitles } from '@/lib/jikan'
import type { Anime } from '@/lib/types'
import { AnimeCard } from '@/components/AnimeCard'
import { GenreFilter } from '@/components/GenreFilter'
import { ExternalSearch } from '@/components/ExternalSearch'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

const GRID =
  'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 md:gap-4 lg:grid-cols-5 xl:grid-cols-6'

const matchesQuery = (a: Anime, q: string) =>
  !q ||
  a.title.toLowerCase().includes(q) ||
  (a.title_english?.toLowerCase().includes(q) ?? false)

export function AnimeGrid() {
  const anime = useStore((s) => s.anime)
  const status = useStore((s) => s.status)
  const genreIds = useStore((s) => s.genreIds)
  const sort = useStore((s) => s.sort)
  const query = useStore((s) => s.query)
  const select = useStore((s) => s.select)
  const load = useStore((s) => s.load)
  const media = useStore((s) => s.media)
  const favorites = usePrefs((s) => s.genres)
  const forYou = usePrefs((s) => s.forYou)
  const starred = usePrefs((s) => s.starred)
  const starredItems = usePrefs((s) => s.starredItems)

  const starredIds = useMemo(() => {
    const p = `${media}:`
    return new Set(
      starred.filter((k) => k.startsWith(p)).map((k) => Number(k.slice(p.length))),
    )
  }, [starred, media])

  const genres = useMemo(() => deriveGenres(anime), [anime])

  // Local list (season / airing), filtered + sorted.
  const listed = useMemo(
    () =>
      filterAndSort(anime, genreIds, sort, query, favorites, forYou, starredIds),
    [anime, genreIds, sort, query, favorites, forYou, starredIds],
  )

  // For You also surfaces starred titles not in the current list (e.g. ones you
  // searched for and saved) — pinned to the top.
  const visible = useMemo(() => {
    if (!forYou) return listed
    const q = query.trim().toLowerCase()
    const inList = new Set(listed.map((a) => a.mal_id))
    const extras = Object.values(starredItems)
      .filter((e) => e.media === media && !inList.has(e.item.mal_id))
      .map((e) => e.item)
      .filter((a) => matchesQuery(a, q))
    return [...extras, ...listed]
  }, [forYou, listed, starredItems, media, query])

  // Live search: a query that matches nothing locally (and not in For You)
  // fetches results from the search endpoint.
  const [remote, setRemote] = useState<Anime[]>([])
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    const q = query.trim()
    if (!q || forYou || listed.length > 0) {
      setRemote([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      const r = await searchTitles(q, media)
      setRemote(r)
      setSearching(false)
    }, 450)
    return () => clearTimeout(t)
  }, [query, forYou, listed.length, media])

  if (status === 'loading') return <GridSkeleton />

  if (status === 'error') {
    return (
      <Empty
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

  const q = query.trim()
  const items = visible.length > 0 ? visible : remote
  const isSearchView = visible.length === 0 && !!q && !forYou

  return (
    <div className="space-y-4">
      <GenreFilter genres={genres} />

      <ExternalSearch query={query} media={media} />

      {isSearchView && (items.length > 0 || searching) && (
        <p className="text-xs font-medium text-muted-foreground">
          {searching
            ? `Searching all ${media} for “${q}”…`
            : `Search results for “${q}”`}
        </p>
      )}

      {items.length > 0 ? (
        <div className={GRID}>
          {items.map((a, i) => (
            <AnimeCard
              key={a.mal_id}
              anime={a}
              index={i}
              matched={!forYou && favorites.length > 0 && isMatch(a, favorites)}
              onSelect={select}
            />
          ))}
        </div>
      ) : searching ? (
        <div className={GRID}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <Empty
          title="Nothing here~"
          body={
            q
              ? `No ${media} found for “${q}”. Try the source buttons above to search the streaming/reading sites.`
              : `No ${media} match those filters. Try clearing them!`
          }
        />
      )}

      {items.length > 0 && !isSearchView && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          {items.length} titles 🌸
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
  title,
  body,
  action,
}: {
  crying?: boolean
  title: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <img
        src={`${import.meta.env.BASE_URL}404.gif`}
        alt="Nothing found"
        className="w-44 max-w-[70%] rounded-2xl drop-shadow-[0_8px_24px_rgba(255,77,109,0.25)]"
      />
      <div>
        <p className="font-display text-lg font-bold text-foreground">{title}</p>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  )
}
