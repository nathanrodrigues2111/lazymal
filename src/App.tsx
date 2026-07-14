import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

import { useStore } from '@/store/useStore'
import { usePrefs } from '@/store/usePrefs'
import { currentSeason, seasonEmoji, seasonLabel } from '@/lib/season'
import { Toolbar } from '@/components/Toolbar'
import { AnimeGrid } from '@/components/AnimeGrid'
import { DetailSheet } from '@/components/DetailSheet'
import { Onboarding } from '@/components/Onboarding'
import { Settings } from '@/components/Settings'
import { PullToRefresh } from '@/components/PullToRefresh'
import { MediaToggle } from '@/components/MediaToggle'
import { SwipeNav } from '@/components/SwipeNav'
import { Toast } from '@/components/Toast'

const SEASON = currentSeason()

export default function App() {
  const load = useStore((s) => s.load)
  const refresh = useStore((s) => s.refresh)
  const prewarmOther = useStore((s) => s.prewarmOther)
  const media = useStore((s) => s.media)
  const detailOpen = useStore((s) => s.selected !== null)
  const onboarded = usePrefs((s) => s.onboarded)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const isManga = media === 'manga'

  // Load the current media on mount, then warm the other mode's cache in the
  // background so toggling Anime/Manga is instant.
  useEffect(() => {
    void load().then(() => {
      setTimeout(() => void prewarmOther(), 1500)
    })
  }, [load, prewarmOther])

  // Disable pull-to-refresh while any sheet/modal is open so their own
  // drag gestures don't trigger a refresh.
  const sheetOpen = detailOpen || settingsOpen || !onboarded

  // Pull-to-refresh: re-fetch (+toast), held for ~1s so the gesture reads as a
  // real refresh even when the network is instant.
  const pullRefresh = async () => {
    await Promise.all([refresh(), new Promise((r) => setTimeout(r, 1000))])
  }

  return (
    <>
      <PullToRefresh onRefresh={pullRefresh} disabled={sheetOpen}>
        <div className="mx-auto flex min-h-svh w-full max-w-[540px] flex-col md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
          {/* Sticky control deck */}
          <header className="sticky top-0 z-10 space-y-3 border-b border-line/70 bg-ink/80 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Open settings"
                  className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand/10 text-2xl transition-transform active:scale-90"
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={isManga ? 'manga' : 'anime'}
                      initial={{ opacity: 0, scale: 0.4, rotate: -35 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.4, rotate: 35 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    >
                      {isManga ? '📖' : seasonEmoji(SEASON.season)}
                    </motion.span>
                  </AnimatePresence>
                </button>
                <div className="leading-tight">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={isManga ? 'manga' : 'anime'}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="font-display text-lg font-extrabold text-foreground">
                        {isManga ? 'Manga' : 'Anime'}
                      </p>
                      <p className="text-xs font-medium text-brand">
                        {isManga ? 'Top manga' : seasonLabel(SEASON)}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <MediaToggle />
            </div>
            <Toolbar />
          </header>

          {/* Content */}
          <main className="flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-4 md:px-6">
            <AnimeGrid />
          </main>
        </div>
      </PullToRefresh>

      <SwipeNav disabled={sheetOpen} />
      <DetailSheet />
      <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Onboarding />
      <Toast />
    </>
  )
}
