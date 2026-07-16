import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useScroll,
  useSpring,
} from 'motion/react'

import { useStore } from '@/store/useStore'
import { usePrefs } from '@/store/usePrefs'
import { seasonEmoji, seasonLabel } from '@/lib/season'
import { cn } from '@/lib/utils'
import { Toolbar } from '@/components/Toolbar'
import { AnimeGrid } from '@/components/AnimeGrid'
import { PullToRefresh } from '@/components/PullToRefresh'
import { MediaToggle } from '@/components/MediaToggle'
import { SwipeNav } from '@/components/SwipeNav'
import { GestureLayer } from '@/components/GestureLayer'
import { SearchClose } from '@/components/SearchClose'
import { Toast } from '@/components/Toast'

// Modals aren't needed for first paint — split them into their own chunks
// (which also carry the heavy `vaul` drawer) and mount them during idle time,
// so the app shell parses and paints with the smallest possible bundle.
const DetailSheet = lazy(() =>
  import('@/components/DetailSheet').then((m) => ({ default: m.DetailSheet })),
)
const Settings = lazy(() =>
  import('@/components/Settings').then((m) => ({ default: m.Settings })),
)
const Onboarding = lazy(() =>
  import('@/components/Onboarding').then((m) => ({ default: m.Onboarding })),
)
const Tour = lazy(() =>
  import('@/components/Tour').then((m) => ({ default: m.Tour })),
)

export default function App() {
  const load = useStore((s) => s.load)
  const refresh = useStore((s) => s.refresh)
  const prewarmOther = useStore((s) => s.prewarmOther)
  const media = useStore((s) => s.media)
  const query = useStore((s) => s.query)
  const season = useStore((s) => s.season)
  const cycleSeason = useStore((s) => s.cycleSeason)
  const detailOpen = useStore((s) => s.selected !== null)
  const onboarded = usePrefs((s) => s.onboarded)
  const forYou = usePrefs((s) => s.forYou)
  const toured = usePrefs((s) => s.toured)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Defer mounting the modal chunks until the browser is idle after first
  // paint, keeping them (and their heavy `vaul` drawer) off the boot path.
  const [modalsReady, setModalsReady] = useState(false)
  useEffect(() => {
    const ric = window.requestIdleCallback
    if (ric) {
      const id = ric(() => setModalsReady(true))
      return () => window.cancelIdleCallback(id)
    }
    const id = setTimeout(() => setModalsReady(true), 200)
    return () => clearTimeout(id)
  }, [])

  // Suppress the right-click / long-press context menu (copy · paste · select
  // all) app-wide for a native feel — but leave it on real text fields so the
  // search box still works normally.
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, [contenteditable="true"]')) return
      e.preventDefault()
    }
    document.addEventListener('contextmenu', onContextMenu)
    return () => document.removeEventListener('contextmenu', onContextMenu)
  }, [])

  const isManga = media === 'manga'

  // Header subtitle reflects what the grid is actually showing, so it isn't a
  // misleading "Summer 2026" while searching or on the For You tab.
  const headerSubtitle = query.trim()
    ? 'Search results'
    : forYou
      ? 'For You'
      : isManga
        ? 'Top manga'
        : seasonLabel(season)

  // Tapping the header (anime, not searching/For You) walks back through recent
  // seasons — current → −1 → −2 → −3 → back to current — so all four seasons
  // (spring/summer/fall/winter) are reachable in a loop.
  const canCycleSeason = !isManga && !forYou && !query.trim()

  // Season icon: tap cycles the season (like the title); press-and-hold opens
  // settings/taste. A long-press timer fires the modal; a quick release cycles.
  const holdTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const heldRef = useRef(false)
  const iconPointerDown = () => {
    heldRef.current = false
    holdTimer.current = setTimeout(() => {
      heldRef.current = true
      setSettingsOpen(true)
    }, 450)
  }
  const iconRelease = () => clearTimeout(holdTimer.current)
  const iconClick = () => {
    clearTimeout(holdTimer.current)
    if (heldRef.current) {
      heldRef.current = false // long-press already opened settings
      return
    }
    if (canCycleSeason) cycleSeason()
    else setSettingsOpen(true) // manga / search / For You: fall back to settings
  }

  // Spin the sakura as the page scrolls (spring-smoothed so it eases nicely).
  // Sakura does one smooth full spin the moment the page scroll touches the
  // top. Hysteresis (arm past 60px, fire at ≤2px) keeps it to one spin per
  // touch and avoids jitter right at the edge.
  const { scrollY } = useScroll()
  const rotate = useMotionValue(0)
  const armed = useRef(false)
  useMotionValueEvent(scrollY, 'change', (y) => {
    if (y <= 2 && armed.current) {
      armed.current = false
      rotate.set(rotate.get() + 360)
    } else if (y > 60) {
      armed.current = true
    }
  })
  const spin = useSpring(rotate, { stiffness: 45, damping: 15, mass: 0.6 })

  // Load the current media on mount, then warm the other mode's cache in the
  // background so toggling Anime/Manga is instant.
  useEffect(() => {
    void load().then(() => {
      setTimeout(() => void prewarmOther(), 1500)
    })
  }, [load, prewarmOther])

  // Disable pull-to-refresh while any sheet/modal is open so their own
  // drag gestures don't trigger a refresh.
  const sheetOpen = detailOpen || settingsOpen || !onboarded || !toured

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
          <header className="sticky top-0 z-10 space-y-3 border-b border-line/70 bg-ink/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={iconClick}
                  onPointerDown={iconPointerDown}
                  onPointerUp={iconRelease}
                  onPointerLeave={iconRelease}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label={
                    canCycleSeason
                      ? 'Change season (hold for settings)'
                      : 'Open settings'
                  }
                  className="grid size-11 shrink-0 select-none touch-none place-items-center overflow-hidden rounded-2xl bg-brand/10 text-2xl transition-transform active:scale-90"
                >
                  <motion.span
                    style={{ rotate: isManga ? 0 : spin }}
                    className="grid place-items-center"
                  >
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={
                          isManga ? 'manga' : forYou ? 'foryou' : season.season
                        }
                        initial={{ opacity: 0, scale: 0.4, rotate: -35 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        exit={{ opacity: 0, scale: 0.4, rotate: 35 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      >
                        {isManga ? '📖' : forYou ? '🌸' : seasonEmoji(season.season)}
                      </motion.span>
                    </AnimatePresence>
                  </motion.span>
                </button>
                <button
                  type="button"
                  data-tour="season"
                  onClick={canCycleSeason ? cycleSeason : undefined}
                  aria-label={canCycleSeason ? 'Change season' : undefined}
                  className={cn(
                    'p-0 text-left leading-tight',
                    canCycleSeason && 'cursor-pointer active:scale-[0.98]',
                  )}
                >
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
                      <div className="text-xs font-medium text-brand">
                        <AnimatePresence mode="wait" initial={false}>
                          <motion.p
                            key={headerSubtitle}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{
                              duration: 0.22,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          >
                            {headerSubtitle}
                          </motion.p>
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </button>
              </div>
              <MediaToggle />
            </div>
            <Toolbar />
          </header>

          {/* Content */}
          <main className="flex flex-1 flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-4 md:px-6">
            <AnimeGrid />
          </main>
        </div>
      </PullToRefresh>

      <SwipeNav disabled={sheetOpen} />
      <GestureLayer disabled={sheetOpen} />
      <SearchClose />
      {(modalsReady || detailOpen) && (
        <Suspense fallback={null}>
          <DetailSheet />
        </Suspense>
      )}
      {(modalsReady || settingsOpen) && (
        <Suspense fallback={null}>
          <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
        </Suspense>
      )}
      {(modalsReady || !onboarded) && (
        <Suspense fallback={null}>
          <Onboarding />
        </Suspense>
      )}
      {!toured && (
        <Suspense fallback={null}>
          <Tour />
        </Suspense>
      )}
      <Toast />
    </>
  )
}
