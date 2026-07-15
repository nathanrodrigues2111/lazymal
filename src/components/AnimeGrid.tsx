import { useEffect, useMemo, useRef, useState } from 'react'

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

// How many cards to reveal per scroll batch.
const PAGE = 24

export function AnimeGrid() {
  const anime = useStore((s) => s.anime)
  const status = useStore((s) => s.status)
  const genreIds = useStore((s) => s.genreIds)
  const sort = useStore((s) => s.sort)
  const query = useStore((s) => s.query)
  const select = useStore((s) => s.select)
  const load = useStore((s) => s.load)
  const media = useStore((s) => s.media)
  const clearGenres = useStore((s) => s.clearGenres)
  const favorites = usePrefs((s) => s.genres)
  const forYou = usePrefs((s) => s.forYou)
  const toggleForYou = usePrefs((s) => s.toggleForYou)
  const starred = usePrefs((s) => s.starred)
  const starredItems = usePrefs((s) => s.starredItems)

  // Searching spans everything: reset any active genre chip / For You so a
  // query isn't scoped to a subset — it goes to "All".
  useEffect(() => {
    if (!query.trim()) return
    if (genreIds.length > 0) clearGenres()
    if (forYou) toggleForYou()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

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
  // searched for and saved) — pinned to the top. Shown regardless of any
  // lingering search query, since For You isn't a search view.
  const visible = useMemo(() => {
    if (!forYou) return listed
    const inList = new Set(listed.map((a) => a.mal_id))
    const extras = Object.values(starredItems)
      .filter((e) => e.media === media && !inList.has(e.item.mal_id))
      .map((e) => e.item)
    return [...extras, ...listed]
  }, [forYou, listed, starredItems, media])

  // If the For You tab empties out (e.g. you unstarred your last favorite),
  // drop back to All automatically instead of showing a dead-end empty state.
  useEffect(() => {
    if (forYou && status === 'ready' && visible.length === 0) toggleForYou()
  }, [forYou, status, visible.length, toggleForYou])

  // Live search: any query searches ALL anime/manga via the search endpoint
  // (not just the loaded season list), unless we're in the For You view.
  const [remote, setRemote] = useState<Anime[]>([])
  const [searching, setSearching] = useState(false)
  useEffect(() => {
    const q = query.trim()
    if (!q || forYou) {
      setRemote([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      const r = await searchTitles(q, media)
      setRemote(r)
      setSearching(false)
    }, 400)
    return () => clearTimeout(t)
  }, [query, forYou, media])

  // Progressive rendering: only mount a batch of cards, appending more as the
  // sentinel nears the viewport. Keeps the DOM small and the first paint cheap
  // even on lists of hundreds — critical for weaker devices.
  const q = query.trim()
  const searchMode = !!q && !forYou
  const items = searchMode ? remote : visible

  const [limit, setLimit] = useState(PAGE)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  // Reset the reveal window only when the actual list criteria change (media,
  // sort, filters, tab, search) — NOT on array-identity churn, which would keep
  // snapping the window back to page one and make "load more" appear broken.
  const resetKey = `${media}|${sort}|${forYou}|${searchMode}|${genreIds.join(',')}|${q}`
  useEffect(() => {
    setLimit(PAGE)
  }, [resetKey])

  // Reveal the next batch as the sentinel nears the viewport. Re-arm on every
  // `limit` change: an IntersectionObserver only fires on a *crossing*, so if
  // the sentinel is still in range after a batch renders it would never fire
  // again (very common on wide tablet grids). Re-observing re-checks the
  // intersection and keeps filling until the sentinel is pushed out of range or
  // the list is exhausted.
  useEffect(() => {
    if (limit >= items.length) return
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setLimit((l) => l + PAGE)
      },
      { rootMargin: '600px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [items, limit])

  if (status === 'loading') return <GridSkeleton />

  if (status === 'error') {
    return (
      <Empty
        title="It won’t load…"
        body="MyAnimeList is being a little sleepy right now. Give it a sec and try again."
        action={
          <Button onClick={() => load()} className="rounded-full">
            Try again
          </Button>
        }
      />
    )
  }

  const shown = items.slice(0, limit)
  const hasMore = limit < items.length

  return (
    <div className="space-y-4">
      <GenreFilter genres={genres} />

      <ExternalSearch query={query} media={media} />

      {searchMode && (items.length > 0 || searching) && (
        <p className="text-xs font-medium text-muted-foreground">
          {searching
            ? `Peeking through every ${media} for “${q}”…`
            : `Here’s what I found for “${q}”`}
        </p>
      )}

      {items.length > 0 ? (
        <>
          <div className={GRID}>
            {shown.map((a, i) => (
              <AnimeCard
                key={a.mal_id}
                anime={a}
                index={i}
                matched={!forYou && favorites.length > 0 && isMatch(a, favorites)}
                onSelect={select}
              />
            ))}
          </div>
          {hasMore && <div ref={sentinelRef} aria-hidden className="h-1 w-full" />}
        </>
      ) : searching ? (
        <div className={GRID}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-2xl" />
          ))}
        </div>
      ) : (
        <Empty
          title={q ? 'Nothing found…' : 'It’s a little empty here…'}
          body={
            q
              ? `Couldn’t find any ${media} called “${q}” anywhere. Try the source buttons above to peek at the streaming sites.`
              : `Nothing matches these filters. Tap “All” to see everything again.`
          }
        />
      )}

      {items.length > 0 && !searchMode && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          {items.length} lovely {items.length === 1 ? 'title' : 'titles'}
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
        src={`${import.meta.env.BASE_URL}empty.gif`}
        alt="Nothing found"
        width={200}
        height={240}
        className="h-auto w-32 drop-shadow-[0_8px_24px_rgba(255,77,109,0.25)]"
      />
      <div>
        <p className="font-display text-lg font-bold text-foreground">{title}</p>
        <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  )
}
