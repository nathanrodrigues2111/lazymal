import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Sparkles } from 'lucide-react'

import { usePrefs } from '@/store/usePrefs'
import { GenrePicker } from '@/components/GenrePicker'
import { Button } from '@/components/ui/button'

/** First-run genre picker. Shown once until the user finishes or skips it. */
export function Onboarding() {
  const onboarded = usePrefs((s) => s.onboarded)
  const complete = usePrefs((s) => s.completeOnboarding)
  const [picks, setPicks] = useState<string[]>([])

  const toggle = (name: string) =>
    setPicks((p) =>
      p.includes(name) ? p.filter((g) => g !== name) : [...p, name],
    )

  return (
    <AnimatePresence>
      {!onboarded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/90 backdrop-blur-md sm:items-center"
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 24 }}
            className="max-h-[92svh] w-full max-w-[460px] overflow-y-auto rounded-t-3xl border border-line bg-panel p-6 pb-7 sm:rounded-3xl"
          >
            <div className="mb-1 flex items-center gap-2">
              <Sparkles className="size-5 text-brand" />
              <h2 className="font-display text-2xl font-extrabold text-foreground">
                What do you love?
              </h2>
            </div>
            <p className="mb-5 text-sm text-muted-foreground">
              Pick a few genres and lazymal will highlight this season’s anime
              made just for you~ Change it anytime from settings.
            </p>

            <GenrePicker selected={picks} onToggle={toggle} />

            <div className="mt-6 flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 rounded-full"
                onClick={() => complete([])}
              >
                Skip
              </Button>
              <Button
                variant={picks.length === 0 ? 'secondary' : 'default'}
                className="flex-[2] rounded-full"
                size="lg"
                disabled={picks.length === 0}
                onClick={() => complete(picks)}
              >
                Show my picks{picks.length > 0 ? ` (${picks.length})` : ''}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
