import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react'

import { usePrefs } from '@/store/usePrefs'
import { QUIZ } from '@/lib/quiz'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/** First-run taste quiz: a few tappable questions that infer favorite genres. */
export function Onboarding() {
  const onboarded = usePrefs((s) => s.onboarded)
  const complete = usePrefs((s) => s.completeOnboarding)

  const [step, setStep] = useState(0)
  // step index -> selected option indices
  const [answers, setAnswers] = useState<Record<number, number[]>>({})

  const q = QUIZ[step]
  const isLast = step === QUIZ.length - 1
  const selected = answers[step] ?? []

  const toggle = (i: number) =>
    setAnswers((a) => {
      const cur = a[step] ?? []
      return {
        ...a,
        [step]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i],
      }
    })

  const genres = useMemo(() => {
    const set = new Set<string>()
    for (const [s, idxs] of Object.entries(answers))
      for (const i of idxs)
        for (const g of QUIZ[+s].options[i].genres) set.add(g)
    return [...set]
  }, [answers])

  const next = () => (isLast ? complete(genres) : setStep((s) => s + 1))

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
            className="flex max-h-[92svh] w-full max-w-[460px] flex-col rounded-t-3xl border border-line bg-panel p-6 pb-7 sm:rounded-3xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-5 text-brand" />
                <span className="font-display text-sm font-bold text-foreground">
                  Find your picks
                </span>
              </div>
              <button
                onClick={() => complete(genres)}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Skip
              </button>
            </div>

            {/* Progress segments */}
            <div className="mt-4 flex gap-1.5">
              {QUIZ.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    i <= step ? 'bg-brand' : 'bg-line',
                  )}
                />
              ))}
            </div>

            {/* Question + options */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="mt-6"
              >
                <h2 className="font-display text-2xl font-extrabold leading-tight text-foreground">
                  {q.question}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{q.hint}</p>

                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  {q.options.map((opt, i) => {
                    const active = selected.includes(i)
                    return (
                      <motion.button
                        key={opt.label}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => toggle(i)}
                        className={cn(
                          'relative flex h-24 flex-col items-start justify-between rounded-2xl border p-3 text-left transition-colors',
                          active
                            ? 'border-brand bg-brand/15'
                            : 'border-line bg-panel-2 hover:border-line/80',
                        )}
                      >
                        <span className="text-2xl leading-none">{opt.emoji}</span>
                        <span
                          className={cn(
                            'text-sm font-semibold leading-tight',
                            active ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {opt.label}
                        </span>
                        {active && (
                          <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-brand text-white">
                            <Check className="size-3" />
                          </span>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              </motion.div>
            </AnimatePresence>

            {/* Nav */}
            <div className="mt-6 flex gap-3">
              {step > 0 && (
                <Button
                  variant="secondary"
                  size="lg"
                  className="rounded-full"
                  onClick={() => setStep((s) => s - 1)}
                >
                  <ArrowLeft className="size-4" />
                  Back
                </Button>
              )}
              <Button
                size="lg"
                className="flex-1 rounded-full"
                onClick={next}
              >
                {isLast ? (
                  <>
                    Show my picks
                    {genres.length > 0 ? ` (${genres.length})` : ''}
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
