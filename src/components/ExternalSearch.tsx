import { Play, Search } from 'lucide-react'

import type { Media } from '@/lib/types'
import { READ_SOURCES, WATCH_SOURCES } from '@/lib/watch'

/**
 * Lets the current search query be run against the watch/read sources' own
 * databases — handy when a title isn't in this season's list.
 */
export function ExternalSearch({
  query,
  media,
}: {
  query: string
  media: Media
}) {
  const q = query.trim()
  if (!q) return null
  const sources = media === 'manga' ? READ_SOURCES : WATCH_SOURCES
  const verb = media === 'manga' ? 'Read' : 'Watch'

  return (
    <div className="rounded-2xl border border-line bg-panel-2/60 p-3.5">
      <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Search className="size-3.5" />
        {verb} “<span className="font-semibold text-foreground">{q}</span>” on
      </p>
      <div className="flex flex-wrap gap-2">
        {sources.map((src) => (
          <a
            key={src.name}
            href={src.build({ romaji: q, english: q })}
            target="_blank"
            rel="noreferrer noopener"
            className="flex items-center gap-1.5 rounded-full border border-line bg-panel px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-brand/50 hover:bg-accent active:scale-[0.97]"
          >
            <Play className="size-3 shrink-0 fill-brand text-brand" />
            {src.name}
          </a>
        ))}
      </div>
    </div>
  )
}
