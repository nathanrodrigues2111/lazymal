import { useEffect, useState } from 'react'
import { AnimatePresence, motion, Reorder, useDragControls } from 'motion/react'
import {
  BadgeCheck,
  CalendarClock,
  Check,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  GripVertical,
  Languages,
  Pencil,
  Play,
  Star,
  Users,
  Hash,
  Trophy,
} from 'lucide-react'

import { useStore } from '@/store/useStore'
import { usePrefs } from '@/store/usePrefs'
import { fetchDetails, fetchStreaming } from '@/lib/jikan'
import { fetchEpisodeInfo, type EpisodeInfo } from '@/lib/dub'
import { cn, compact } from '@/lib/utils'
import { countdown, localAirLabel, nextAiring } from '@/lib/airing'
import {
  FMHY_READING,
  FMHY_VIDEO,
  LEGAL_READ_SOURCES,
  LEGAL_SOURCES,
  READ_SOURCES,
  WATCH_SOURCES,
  orderSources,
} from '@/lib/watch'
import type { WatchSource } from '@/lib/watch'
import type { Anime } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'

/**
 * A single source row, stable across view/edit so its icons animate in place.
 * View mode: tap to open the launcher. Edit mode: drag the grip to reorder
 * (via `useDragControls`, which works with mouse + touch), and toggle the eye
 * to hide/show. `data-vaul-no-drag` stops the grip from dragging the sheet.
 */
function SourceRow({
  src,
  editing,
  isHidden,
  href,
  onToggleHide,
}: {
  src: WatchSource
  editing: boolean
  isHidden: boolean
  href: string
  onToggleHide: () => void
}) {
  const controls = useDragControls()
  const open = () => {
    if (!editing) window.open(href, '_blank', 'noopener,noreferrer')
  }
  const iconTransition = { duration: 0.12, ease: [0.22, 1, 0.36, 1] as const }
  return (
    <Reorder.Item
      value={src.name}
      dragListener={false}
      dragControls={controls}
      data-vaul-no-drag
      whileDrag={{ scale: 1.03 }}
      onClick={open}
      onKeyDown={(e) => {
        if (!editing && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          open()
        }
      }}
      role={editing ? undefined : 'link'}
      tabIndex={editing ? undefined : 0}
      className={cn(
        'flex select-none items-center gap-2.5 rounded-xl border bg-panel-2 px-4 py-3 text-sm font-semibold text-foreground transition-colors',
        editing
          ? isHidden
            ? 'border-line opacity-45'
            : 'border-brand/40'
          : 'cursor-pointer border-line hover:border-brand/50 hover:bg-accent active:scale-[0.99]',
      )}
    >
      {/* Left: Play (view) <-> grip drag handle (edit) — fixed slot, no shift */}
      <div className="grid size-5 shrink-0 place-items-center">
        <AnimatePresence mode="wait" initial={false}>
          {editing ? (
            <motion.button
              type="button"
              key="grip"
              onPointerDown={(e) => controls.start(e)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Drag to reorder ${src.name}`}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={iconTransition}
              className="grid size-5 cursor-grab touch-none place-items-center text-muted-foreground active:cursor-grabbing"
            >
              <GripVertical className="size-4" />
            </motion.button>
          ) : (
            <motion.span
              key="play"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={iconTransition}
              className="grid place-items-center"
            >
              <Play className="size-4 fill-brand text-brand" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <span className="flex-1">{src.name}</span>

      {/* Right: ExternalLink (view) <-> eye hide toggle (edit) — fixed slot */}
      <div className="grid size-5 shrink-0 place-items-center">
        <AnimatePresence mode="wait" initial={false}>
          {editing ? (
            <motion.button
              type="button"
              key={isHidden ? 'off' : 'on'}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onToggleHide()
              }}
              aria-label={isHidden ? `Show ${src.name}` : `Hide ${src.name}`}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={iconTransition}
              className="grid size-5 place-items-center text-muted-foreground transition-colors hover:text-foreground"
            >
              {isHidden ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </motion.button>
          ) : (
            <motion.span
              key="ext"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={iconTransition}
              className="grid place-items-center"
            >
              <ExternalLink className="size-3.5 text-muted-foreground" />
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </Reorder.Item>
  )
}

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

  // Dub availability (anime only) — make sure it's fetched when the sheet opens.
  const dub = useStore((s) => (shown ? s.dub[shown.mal_id] : undefined))
  const ensureDub = useStore((s) => s.ensureDub)
  const [epInfo, setEpInfo] = useState<EpisodeInfo | null>(null)
  useEffect(() => {
    setEpInfo(null)
    if (shown && !isManga) {
      void ensureDub(shown.mal_id)
      let cancelled = false
      fetchEpisodeInfo(shown.mal_id).then((e) => {
        if (!cancelled) setEpInfo(e)
      })
      return () => {
        cancelled = true
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown?.mal_id, isManga])

  // Official links for this title — streaming services (anime) or licensed
  // readers (manga). Falls back to per-service search links when MAL lists none.
  const [streaming, setStreaming] = useState<{ name: string; url: string }[]>([])
  const [loadingStreaming, setLoadingStreaming] = useState(false)
  useEffect(() => {
    setStreaming([])
    if (!shown) return
    let cancelled = false
    setLoadingStreaming(true)
    fetchStreaming(isManga ? 'manga' : 'anime', shown.mal_id)
      .then((s) => {
        if (!cancelled) setStreaming(s)
      })
      .finally(() => {
        if (!cancelled) setLoadingStreaming(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown?.mal_id, isManga])

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

            {/* Sub/Dub availability + episode progress (anime only). Worded so
                it's clear subs always exist and a dub is the extra. */}
            {!isManga && (
              <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-panel-2 px-2.5 py-1 font-semibold text-foreground">
                  <Languages
                    className={cn(
                      'size-4',
                      dub === true ? 'text-emerald-400' : 'text-muted-foreground',
                    )}
                  />
                  {dub === true
                    ? 'Subbed & Dubbed'
                    : dub === false
                      ? 'Subbed · no dub yet'
                      : 'Subbed'}
                </span>
                {(() => {
                  const total = epInfo?.total ?? shown.episodes
                  const aired = epInfo?.airedSub
                  let text: string | null = null
                  if (epInfo?.releasing && aired != null)
                    text = total
                      ? `${aired} of ${total} eps subbed`
                      : `${aired} eps subbed so far`
                  else if (total) text = `${total} episodes`
                  return text ? (
                    <span className="rounded-lg bg-panel-2 px-2.5 py-1 text-muted-foreground">
                      {text}
                    </span>
                  ) : null
                })()}
              </div>
            )}

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

            {/* Watch / Read online — one section with an Official group (legal
                streaming/readers) and an Others group (community sources). */}
            <div className="mt-7 border-t border-line/60 pt-5">
              <h4 className="mb-4 flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
                <Play className="size-3.5 fill-brand text-brand" />
                {isManga ? 'Read online' : 'Watch online'}
              </h4>

              {/* Official */}
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                <BadgeCheck className="size-3.5" />
                Official
              </p>
              {loadingStreaming && streaming.length === 0 ? (
                <div className="flex flex-col gap-2">
                  {[0, 1].map((i) => (
                    <span
                      key={i}
                      className="shimmer h-[46px] rounded-xl bg-panel-2"
                    />
                  ))}
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-2">
                    {(streaming.length > 0
                      ? streaming
                      : (isManga ? LEGAL_READ_SOURCES : LEGAL_SOURCES).map(
                          (s) => ({
                            name: s.name,
                            url: s.build({
                              romaji: shown.title,
                              english: shown.title_english,
                            }),
                          }),
                        )
                    ).map((s) => (
                      <a
                        key={s.name}
                        href={s.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex select-none items-center gap-2.5 rounded-xl border border-line bg-panel-2 px-4 py-3 text-sm font-semibold text-foreground transition-colors hover:border-emerald-400/50 hover:bg-accent active:scale-[0.99]"
                      >
                        <BadgeCheck className="size-4 shrink-0 text-emerald-400" />
                        <span className="flex-1">{s.name}</span>
                        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                  {streaming.length === 0 && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      No official listing found — these open a search on each
                      service.
                    </p>
                  )}
                </>
              )}

              {/* Others */}
              <div className="mb-2 mt-5 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                  Others
                </p>
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
                      initial={{ opacity: 0, scale: 0.6, rotate: -30 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.6, rotate: 30 }}
                      transition={{ duration: 0.11, ease: [0.22, 1, 0.36, 1] }}
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
              {!editingSources && visibleSources.length === 0 ? (
                <p className="rounded-xl border border-line bg-panel-2 px-4 py-3 text-center text-xs text-muted-foreground">
                  All sources hidden — tap the pencil to bring them back.
                </p>
              ) : (
                <Reorder.Group
                  axis="y"
                  values={(editingSources ? sources : visibleSources).map(
                    (s) => s.name,
                  )}
                  onReorder={(next) => setSourceOrder(mediaKey, next)}
                  className="flex flex-col gap-2"
                >
                  {(editingSources ? sources : visibleSources).map((src) => (
                    <SourceRow
                      key={src.name}
                      src={src}
                      editing={editingSources}
                      isHidden={hidden.includes(src.name)}
                      href={src.build({
                        romaji: shown.title,
                        english: shown.title_english,
                      })}
                      onToggleHide={() => toggleSourceHidden(mediaKey, src.name)}
                    />
                  ))}
                </Reorder.Group>
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
