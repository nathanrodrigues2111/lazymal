import { useEffect, useState } from 'react'

import { useStore } from '@/store/useStore'
import { usePrefs } from '@/store/usePrefs'
import { currentSeason, seasonEmoji, seasonLabel } from '@/lib/season'
import { Toolbar } from '@/components/Toolbar'
import { AnimeGrid } from '@/components/AnimeGrid'
import { DetailSheet } from '@/components/DetailSheet'
import { Onboarding } from '@/components/Onboarding'
import { Settings } from '@/components/Settings'
import { PullToRefresh } from '@/components/PullToRefresh'

const SEASON = currentSeason()

export default function App() {
  const load = useStore((s) => s.load)
  const detailOpen = useStore((s) => s.selected !== null)
  const onboarded = usePrefs((s) => s.onboarded)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // Load the current season once on mount.
  useEffect(() => {
    void load()
  }, [load])

  // Disable pull-to-refresh while any sheet/modal is open so their own
  // drag gestures don't trigger a refresh.
  const sheetOpen = detailOpen || settingsOpen || !onboarded

  return (
    <>
      <PullToRefresh onRefresh={load} disabled={sheetOpen}>
        <div className="mx-auto flex min-h-svh w-full max-w-[540px] flex-col md:max-w-3xl lg:max-w-5xl xl:max-w-6xl">
          {/* Sticky control deck */}
          <header className="sticky top-0 z-10 border-b border-line/70 bg-ink/80 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-xl md:px-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <div className="flex items-center gap-3 md:shrink-0">
                <button
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Open settings"
                  className="grid size-11 shrink-0 place-items-center rounded-2xl bg-brand/10 text-2xl transition-transform active:scale-90"
                >
                  {seasonEmoji(SEASON.season)}
                </button>
                <div className="leading-tight">
                  <p className="font-display text-lg font-extrabold text-foreground">
                    {seasonLabel(SEASON)}
                  </p>
                  <p className="text-xs font-medium text-brand">This season</p>
                </div>
              </div>
              <div className="md:flex-1">
                <Toolbar />
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] pt-4 md:px-6">
            <AnimeGrid />
          </main>
        </div>
      </PullToRefresh>

      <DetailSheet />
      <Settings open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Onboarding />
    </>
  )
}
