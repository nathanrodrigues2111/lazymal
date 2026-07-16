import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpDown, Check, RefreshCw, Search } from 'lucide-react'

import { useStore } from '@/store/useStore'
import { SORT_LABELS } from '@/lib/filter'
import type { SortKey } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const SORT_KEYS = Object.keys(SORT_LABELS) as SortKey[]

export function Toolbar() {
  const query = useStore((s) => s.query)
  const setQuery = useStore((s) => s.setQuery)
  const sort = useStore((s) => s.sort)
  const setSort = useStore((s) => s.setSort)
  const refresh = useStore((s) => s.refresh)
  const media = useStore((s) => s.media)
  const dubFilter = useStore((s) => s.dubFilter)
  const setDubFilter = useStore((s) => s.setDubFilter)
  const [open, setOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const doRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    // Keep the spinner up for at least ~1s even if the refresh is instant.
    await Promise.all([refresh(), new Promise((r) => setTimeout(r, 1000))])
    setRefreshing(false)
  }

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="app-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={media === 'manga' ? 'Search manga' : 'Search anime'}
          className="pl-10"
          aria-label="Search anime"
        />
      </div>

      <Button
        variant="secondary"
        size="icon"
        className="hidden rounded-full md:inline-flex"
        aria-label="Refresh"
        onClick={doRefresh}
      >
        <RefreshCw className={cn('size-4', refreshing && 'animate-spin')} />
      </Button>

      <div className="relative" data-tour="sort">
        <Button
          variant="secondary"
          size="icon"
          className="rounded-full"
          aria-label="Sort"
          onClick={() => setOpen((o) => !o)}
        >
          <ArrowUpDown className="size-4" />
        </Button>

        <AnimatePresence>
          {open && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setOpen(false)}
                onTouchMove={() => setOpen(false)}
                onWheel={() => setOpen(false)}
              />
              <motion.div
                data-sort-menu
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="absolute right-0 top-full z-30 mt-2 w-44 overflow-hidden rounded-2xl border border-line bg-panel p-1.5 shadow-2xl shadow-black/50"
              >
                {/* Single-select list. "Dubbed" (anime only) is one option
                    that shows dubbed titles by highest MAL score; picking any
                    sort clears it. Exactly one row is ever active. */}
                {media === 'anime' && (
                  <button
                    onClick={() => {
                      setDubFilter('dubbed')
                      setSort('score')
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                      dubFilter === 'dubbed'
                        ? 'bg-primary/15 text-primary'
                        : 'text-foreground hover:bg-accent',
                    )}
                  >
                    Dubbed
                    {dubFilter === 'dubbed' && <Check className="size-4" />}
                  </button>
                )}
                {SORT_KEYS.map((key) => {
                  const active = dubFilter === 'off' && sort === key
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSort(key)
                        setDubFilter('off')
                        setOpen(false)
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary/15 text-primary'
                          : 'text-foreground hover:bg-accent',
                      )}
                    >
                      {SORT_LABELS[key]}
                      {active && <Check className="size-4" />}
                    </button>
                  )
                })}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
