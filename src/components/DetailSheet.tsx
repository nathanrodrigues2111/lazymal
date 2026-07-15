import { useEffect, useState } from 'react'
import { AnimatePresence, motion, Reorder } from 'motion/react'
import {
  CalendarClock,
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  GripVertical,
  Pencil,
  Play,
  Star,
  Users,
  Hash,
  Trophy,
} from 'lucide-react'

import { useStore } from '@/store/useStore'
import { usePrefs } from '@/store/usePrefs'
import { fetchDetails } from '@/lib/jikan'
import { cn, compact } from '@/lib/utils'
import { countdown, localAirLabel, nextAiring } from '@/lib/airing'
import {
  FMHY_READING,
  FMHY_VIDEO,
  READ_SOURCES,
  WATCH_SOURCES,
  orderSources,
} from '@/lib/watch'
import type { Anime } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'

export function DetailSheet() {
  const selected = useStore((s) => s.selected)
  const select = useStore((s) => s.select)

  const open = selected !== null

  // Retain the last selected anime so its content stays rendered while the
  // sheet slides back down on close (instead of blanking out instantly).
  const [shown, setShown] = useState<Anime | null>(null)
  useEffect(() => {
    if (selected) setShown(selected)
  }, [selected])

  // Enrich with full details (rank, popularity, …) that the scraped list lacks.
  const [extra, setExtra] = useState<Anime | null>(null)
  const [loadingExtra, setLoadingExtra] = useState(false)
  useEffect(() => {
    setExtra(null)
    if (!shown) return
    let cancelled = false
    const media =
      shown.publishing !== undefined ||
      shown.chapters !== undefined ||
      shown.volumes !== undefined
        ? 'manga'
        : 'anime'
    setLoadingExtra(true)
    fetchDetails(shown.mal_id, media)
      .then((d) => {
        if (!cancelled && d) setExtra(d)
      })
      .finally(() => {
        if (!cancelled) setLoadingExtra(false)
      })
    return () => {
      cancelled = true
    }
  }, [shown?.mal_id])

  // Favorite (star) toggle.
  const media = useStore((s) => s.media)
  const toggleStar = usePrefs((s) => s.toggleStar)
  const starKey = shown ? `${media}:${shown.mal_id}` : ''
  const starred = usePrefs((s) => (starKey ? s.starred.includes(starKey) : false))

  const [copied, setCopied] = useState(false)
  const copyTitle = async () => {
    if (!shown) return
    try {
      await navigator.clipboard.writeText(shown.title_english || shown.title)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  const isManga =
    !!shown &&
    (shown.publishing !== undefined ||
      shown.chapters !== undefined ||
      shown.volumes !== undefined)
  const sourceOrder = usePrefs((s) => s.sourceOrder)
  const setSourceOrder = usePrefs((s) => s.setSourceOrder)
  const hiddenSources = usePrefs((s) => s.hiddenSources)
  const toggleSourceHidden = usePrefs((s) => s.toggleSourceHidden)
  const mediaKey = isManga ? 'manga' : 'anime'
  const sources = orderSources(
    isManga ? READ_SOURCES : WATCH_SOURCES,
    sourceOrder[mediaKey],
  )
  const hidden = hiddenSources[mediaKey]
  const visibleSources = sources.filter((s) => !hidden.includes(s.name))

  // Reorder mode for the watch/read launcher (toggled by the pencil).
  const [editingSources, setEditingSources] = useState(false)
  useEffect(() => {
    setEditingSources(false)
  }, [shown?.mal_id, open, isManga])

  return (
    <Drawer open={open} onOpenChange={(o) => !o && select(null)}>
      <DrawerContent>
        {shown && (
          <div className="overflow-y-auto overscroll-contain px-5 pb-8 pt-4">
            {/* Header: poster + key facts */}
            <div className="flex gap-4">
              <img
                src={shown.images.webp?.large_image_url || shown.images.jpg.large_image_url}
                alt={shown.title}
                className="h-40 w-28 shrink-0 rounded-xl border border-line object-cover shadow-lg shadow-black/40"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-start gap-2">
                  <DrawerTitle className="clamp-3 flex-1">
                    {shown.title_english || shown.title}
                  </DrawerTitle>
                  <button
                    onClick={() => shown && toggleStar(media, shown)}
                    aria-label={
                      starred ? 'Remove from favorites' : 'Add to favorites'
                    }
                    className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-line bg-panel-2 transition-transform active:scale-90"
                  >
                    <Star
                      className={cn(
                        'size-4',
                        starred
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground',
                      )}
                    />
                  </button>
                  <button
                    onClick={copyTitle}
                    aria-label="Copy title"
                    className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-line bg-panel-2 text-muted-foreground transition-colors hover:text-foreground active:scale-90"
                  >
                    {copied ? (
                      <Check className="size-4 text-brand" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                  </button>
                </div>
                {(() => {
                  const displayed = shown.title_english || shown.title
                  const secondary = [shown.title, extra?.title_japanese].filter(
                    (t) => t && t !== displayed,
                  )
                  if (secondary.length === 0 && !(loadingExtra && !extra))
                    return null
                  return (
                    <DrawerDescription className="clamp-2">
                      {secondary.join(' · ')}
                      {loadingExtra && !extra && (
                        <span className="shimmer ml-1.5 inline-block h-3 w-28 translate-y-0.5 rounded bg-line align-middle" />
                      )}
                    </DrawerDescription>
                  )
                })()}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge className="bg-yellow-400/15 text-yellow-300">
                    <Star className="size-3 fill-current" />
                    {shown.score ? shown.score.toFixed(2) : 'N/A'}
                  </Badge>
                  {(shown.type ?? extra?.type) && (
                    <Badge variant="outline">{shown.type ?? extra?.type}</Badge>
                  )}
                  {extra?.rating && (
                    <Badge variant="outline">{extra.rating.split(' - ')[0]}</Badge>
                  )}
                  {(extra?.episodes ?? shown.episodes) != null && (
                    <Badge variant="outline">
                      {extra?.episodes ?? shown.episodes} eps
                    </Badge>
                  )}
                  {(extra?.chapters ?? shown.chapters) != null && (
                    <Badge variant="outline">
                      {extra?.chapters ?? shown.chapters} ch
                    </Badge>
                  )}
                  {(extra?.volumes ?? shown.volumes) != null && (
                    <Badge variant="outline">
                      {extra?.volumes ?? shown.volumes} vol
                    </Badge>
                  )}
                  {(extra?.status ?? shown.status) && (
                    <Badge variant="secondary">
                      {extra?.status ?? shown.status}
                    </Badge>
                  )}
                  {/* Skeleton pills for rating/status still loading from Jikan */}
                  {loadingExtra && !extra && (
                    <>
                      <span className="shimmer h-[22px] w-9 rounded-full bg-line" />
                      <span className="shimmer h-[22px] w-28 rounded-full bg-line" />
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Stat row */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat icon={<Trophy className="size-3.5" />} label="Rank" value={(extra?.rank ?? shown.rank) ? `#${extra?.rank ?? shown.rank}` : '—'} loading={loadingExtra && (extra?.rank ?? shown.rank) == null} />
              <Stat icon={<Hash className="size-3.5" />} label="Popularity" value={(extra?.popularity ?? shown.popularity) ? `#${extra?.popularity ?? shown.popularity}` : '—'} loading={loadingExtra && (extra?.popularity ?? shown.popularity) == null} />
              <Stat icon={<Users className="size-3.5" />} label="Members" value={compact(extra?.members ?? shown.members)} loading={loadingExtra && (extra?.members ?? shown.members) == null} />
            </div>

            {/* Next episode — broadcast lives on the enriched details, so
                prefer `extra` and fall back to the list item. */}
            {(() => {
              const air = nextAiring(extra ?? shown)
              if (!air) return null
              return (
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-2.5">
                  <CalendarClock className="size-4 shrink-0 text-brand" />
                  <div className="flex-1 text-sm">
                    <span className="font-semibold text-foreground">
                      Next episode
                    </span>{' '}
                    <span className="text-muted-foreground">
                      · {localAirLabel(air)}
                    </span>
                  </div>
                  <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">
                    {countdown(air)}
                  </span>
                </div>
              )
            })()}

            {/* Genres */}
            {shown.genres.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-1.5">
                {[...shown.genres, ...shown.themes].map((g) => (
                  <Badge key={`${g.mal_id}-${g.name}`} variant="secondary">
                    {g.name}
                  </Badge>
                ))}
              </div>
            )}

            {/* Synopsis */}
            <div className="mt-5">
              <h4 className="mb-1.5 font-display text-sm font-semibold text-foreground">
                Synopsis
              </h4>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {shown.synopsis?.replace(/\[Written by.*?\]/g, '').trim() ||
                  'No synopsis available yet.'}
              </p>
            </div>

            {/* Studios / Authors (enriched from Jikan) */}
            {(() => {
              const authors = extra?.authors ?? shown.authors ?? []
              const studios = extra?.studios ?? shown.studios ?? []
              const list = isManga ? authors : studios
              if (list.length === 0) return null
              return (
                <p className="mt-4 text-xs text-muted-foreground">
                  {isManga ? 'Author' : 'Studio'}:{' '}
                  <span className="text-foreground">
                    {list.map((x) => x.name).join(', ')}
                  </span>
                </p>
              )
            })()}

            {/* Watch / Read online */}
            <div className="mt-7 border-t border-line/60 pt-5">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
                  <Play className="size-3.5 fill-brand text-brand" />
                  {isManga ? 'Read online' : 'Watch online'}
                </h4>
                <button
                  onClick={() => setEditingSources((v) => !v)}
                  aria-label={
                    editingSources
                      ? 'Done reordering sources'
                      : 'Reorder sources'
                  }
                  className={cn(
                    'grid size-8 place-items-center rounded-full border transition-colors active:scale-90',
                    editingSources
                      ? 'border-brand/50 text-brand'
                      : 'border-line text-muted-foreground hover:text-foreground',
                  )}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={editingSources ? 'check' : 'pencil'}
                      initial={{ opacity: 0, scale: 0.5, rotate: -40 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.5, rotate: 40 }}
                      transition={{ type: 'spring', stiffness: 900, damping: 32, mass: 0.5 }}
                      className="grid place-items-center"
                    >
                      {editingSources ? (
                        <Check className="size-4" />
                      ) : (
                        <Pencil className="size-4" />
                      )}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </div>
              {editingSources ? (
                <Reorder.Group
                  axis="y"
                  values={sources.map((s) => s.name)}
                  onReorder={(next) => setSourceOrder(mediaKey, next)}
                  className="flex flex-col gap-2"
                >
                  {sources.map((src) => {
                    const isHidden = hidden.includes(src.name)
                    return (
                      <Reorder.Item
                        key={src.name}
                        value={src.name}
                        data-vaul-no-drag
                        whileDrag={{ scale: 1.03 }}
                        className={cn(
                          'flex cursor-grab touch-none select-none items-center gap-2.5 rounded-xl border bg-panel-2 px-4 py-3 text-sm font-semibold text-foreground active:cursor-grabbing',
                          isHidden ? 'border-line opacity-45' : 'border-brand/40',
                        )}
                      >
                        <GripVertical className="size-4 shrink-0 text-muted-foreground" />
                        <span className="flex-1">{src.name}</span>
                        <button
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleSourceHidden(mediaKey, src.name)
                          }}
                          aria-label={
                            isHidden ? `Show ${src.name}` : `Hide ${src.name}`
                          }
                          className="-m-1 grid shrink-0 place-items-center rounded-lg p-1 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                              key={isHidden ? 'off' : 'on'}
                              initial={{ opacity: 0, scale: 0.5, rotate: -30 }}
                              animate={{ opacity: 1, scale: 1, rotate: 0 }}
                              exit={{ opacity: 0, scale: 0.5, rotate: 30 }}
                              transition={{
                                type: 'spring',
                                stiffness: 500,
                                damping: 30,
                              }}
                              className="grid place-items-center"
                            >
                              {isHidden ? (
                                <EyeOff className="size-4" />
                              ) : (
                                <Eye className="size-4" />
                              )}
                            </motion.span>
                          </AnimatePresence>
                        </button>
                      </Reorder.Item>
                    )
                  })}
                </Reorder.Group>
              ) : visibleSources.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {visibleSources.map((src) => (
                    <a
                      key={src.name}
                      href={src.build({
                        romaji: shown.title,
                        english: shown.title_english,
                      })}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-2.5 rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-brand/50 hover:bg-accent active:scale-[0.99]"
                    >
                      <Play className="size-4 shrink-0 fill-brand text-brand" />
                      <span className="flex-1">{src.name}</span>
                      <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-line bg-panel-2 px-4 py-3 text-center text-xs text-muted-foreground">
                  All sources hidden — tap the pencil to bring them back.
                </p>
              )}

              {/* Fallback directory + MyAnimeList, two equal pills. */}
              <div className="mt-7 grid grid-cols-2 gap-2 border-t border-line/60 pt-5">
                <a
                  href={isManga ? FMHY_READING : FMHY_VIDEO}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-brand/50 hover:bg-accent active:scale-[0.99]"
                >
                  More Sites
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                </a>
                <a
                  href={shown.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-brand/50 hover:bg-accent active:scale-[0.99]"
                >
                  MyAnimeList
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                </a>
              </div>
            </div>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}


function Stat({
  icon,
  label,
  value,
  loading = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  loading?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-line bg-panel-2 p-2.5 text-center"
    >
      <div className="flex items-center justify-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      {loading ? (
        <div className="mx-auto mt-1.5 h-4 w-10 rounded bg-line shimmer" />
      ) : (
        <div className="mt-1 font-display text-sm font-bold text-foreground">
          {value}
        </div>
      )}
    </motion.div>
  )
}
