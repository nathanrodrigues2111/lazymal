import { useLayoutEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, X } from 'lucide-react'

import { usePrefs } from '@/store/usePrefs'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface Step {
  title: string
  body: string
  /** CSS selector of the element to spotlight; omit for a centered card. */
  selector?: string
}

const STEPS: Step[] = [
  {
    title: 'Welcome to lazymal 🌸',
    body: "Your cozy corner for this season's anime and manga. Here's a quick tour of every section and gesture.",
  },
  {
    title: 'Anime & Manga',
    body: 'Tap this toggle to switch between anime and manga — or just swipe left and right anywhere on the page.',
    selector: '[data-tour="media"]',
  },
  {
    title: 'Search',
    body: 'Tap here to find any title across all genres. On mobile you can also give a quick flick downward near the very top of the screen to jump straight to search.',
    selector: '#app-search',
  },
  {
    title: 'Sort',
    body: 'Reorder the grid: airing soon, top rated, most popular, most members, A–Z, or newest.',
    selector: '[data-tour="sort"]',
  },
  {
    title: 'Genres, For You & All',
    body: 'Scroll the chips and tap to filter. “For You” matches your taste; “All” resets. Shortcut: double-tap the bottom of the screen to cycle between For You and All.',
    selector: '[data-tour="genres"]',
  },
  {
    title: 'Cards, favorites & sources',
    body: 'Tap the ⭐ on any poster to save it (saved titles power For You). Open a card for the score, synopsis, next-episode countdown, and where to watch or read — tap the pencil there to drag-reorder or hide sources.',
  },
  {
    title: 'Pull to refresh',
    body: 'At the very top of the list, pull down to refresh with the latest data. That’s everything — enjoy! 💖',
  },
]

export function Tour() {
  const completeTour = usePrefs((s) => s.completeTour)
  const [open, setOpen] = useState(true)
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)

  const step = STEPS[i]
  const last = i === STEPS.length - 1
  const finish = () => setOpen(false)

  useLayoutEffect(() => {
    if (!open || !step.selector) {
      setRect(null)
      return
    }
    const measure = () => {
      const el = document.querySelector(step.selector!) as HTMLElement | null
      setRect(el ? el.getBoundingClientRect() : null)
    }
    measure()
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [i, open, step.selector])

  return (
    <AnimatePresence onExitComplete={completeTour}>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60]"
        >
          {/* Block interaction with the app behind the tour. */}
          <div className="absolute inset-0" aria-hidden />

          {rect ? (
            <motion.div
              aria-hidden
              initial={false}
              animate={{
                top: rect.top - 8,
                left: rect.left - 8,
                width: rect.width + 16,
                height: rect.height + 16,
              }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="pointer-events-none fixed rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.82)] ring-2 ring-brand"
            />
          ) : (
            <div
              className="absolute inset-0 bg-ink/90 backdrop-blur-md"
              aria-hidden
            />
          )}

          {/* Tooltip / card */}
          <div
            className={cn(
              'fixed inset-x-0 flex justify-center px-4',
              rect ? '' : 'inset-y-0 items-end sm:items-center',
            )}
            style={
              rect
                ? { top: Math.min(rect.bottom + 16, window.innerHeight - 300) }
                : undefined
            }
          >
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="relative w-full max-w-[420px] overflow-hidden rounded-3xl border border-line bg-panel p-6 shadow-2xl shadow-black/60"
            >
              <button
                onClick={finish}
                aria-label="Close tour"
                className="absolute right-4 top-4 grid size-8 place-items-center rounded-full border border-line bg-panel-2 text-muted-foreground transition-colors hover:text-foreground active:scale-90"
              >
                <X className="size-4" />
              </button>

              <h2 className="pr-8 font-display text-xl font-extrabold text-foreground">
                {step.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>

              <div className="mt-5 flex items-center justify-center gap-1.5">
                {STEPS.map((_, idx) => (
                  <span
                    key={idx}
                    className={cn(
                      'h-1.5 rounded-full transition-all duration-300',
                      idx === i ? 'w-5 bg-brand' : 'w-1.5 bg-line',
                    )}
                  />
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3">
                {i > 0 && (
                  <Button
                    variant="ghost"
                    className="rounded-full"
                    onClick={() => setI((n) => n - 1)}
                  >
                    <ChevronLeft className="size-4" />
                    Back
                  </Button>
                )}
                <Button
                  size="lg"
                  className="flex-1 rounded-full"
                  onClick={() => (last ? finish() : setI((n) => n + 1))}
                >
                  {last ? 'Got it' : 'Next'}
                </Button>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
