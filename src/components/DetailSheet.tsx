import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { Check, Copy, ExternalLink, Play, Star, Users, Hash, Trophy } from 'lucide-react'

import { useStore } from '@/store/useStore'
import { compact } from '@/lib/utils'
import { FMHY_VIDEO, WATCH_SOURCES } from '@/lib/watch'
import type { Anime } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
                </div>
                {shown.title_english && shown.title_english !== shown.title && (
                  <DrawerDescription className="clamp-2">
                    {shown.title}
                  </DrawerDescription>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge className="bg-yellow-400/15 text-yellow-300">
                    <Star className="size-3 fill-current" />
                    {shown.score ? shown.score.toFixed(2) : 'N/A'}
                  </Badge>
                  {shown.type && <Badge variant="outline">{shown.type}</Badge>}
                  {shown.episodes != null && (
                    <Badge variant="outline">{shown.episodes} eps</Badge>
                  )}
                  {shown.status && (
                    <Badge variant="secondary">{shown.status}</Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Stat row */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Stat icon={<Trophy className="size-3.5" />} label="Rank" value={shown.rank ? `#${shown.rank}` : '—'} />
              <Stat icon={<Hash className="size-3.5" />} label="Popularity" value={shown.popularity ? `#${shown.popularity}` : '—'} />
              <Stat icon={<Users className="size-3.5" />} label="Members" value={compact(shown.members)} />
            </div>

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

            {/* Studios */}
            {shown.studios.length > 0 && (
              <p className="mt-4 text-xs text-muted-foreground">
                Studio:{' '}
                <span className="text-foreground">
                  {shown.studios.map((s) => s.name).join(', ')}
                </span>
              </p>
            )}

            {/* Watch online */}
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 font-display text-sm font-semibold text-foreground">
                  <Play className="size-3.5 fill-brand text-brand" />
                  Watch online
                </h4>
                <a
                  href={FMHY_VIDEO}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-[11px] text-muted-foreground underline decoration-line underline-offset-2 hover:text-foreground"
                >
                  more sites ↗
                </a>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {WATCH_SOURCES.map((src) => (
                  <Button key={src.name} asChild className="rounded-full" size="lg">
                    <a
                      href={src.build({
                        romaji: shown.title,
                        english: shown.title_english,
                      })}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <Play className="size-4 fill-current" />
                      {src.name}
                    </a>
                  </Button>
                ))}
              </div>
            </div>

            {/* Link out */}
            <Button
              asChild
              variant="secondary"
              className="mt-3 w-full rounded-full"
              size="lg"
            >
              <a href={shown.url} target="_blank" rel="noreferrer noopener">
                View on MyAnimeList
                <ExternalLink className="size-4" />
              </a>
            </Button>
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
}: {
  icon: React.ReactNode
  label: string
  value: string
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
      <div className="mt-1 font-display text-sm font-bold text-foreground">
        {value}
      </div>
    </motion.div>
  )
}
