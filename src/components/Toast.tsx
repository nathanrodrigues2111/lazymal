import { AnimatePresence, motion } from 'motion/react'
import { Check } from 'lucide-react'

import { useStore } from '@/store/useStore'

/** Transient confirmation pill at the bottom (e.g. after a refresh). */
export function Toast() {
  const toast = useStore((s) => s.toast)
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] z-50 flex justify-center px-4"
        >
          <div className="flex items-center gap-2 rounded-full border border-line bg-panel/95 px-4 py-2.5 text-sm font-semibold text-foreground shadow-2xl shadow-black/50 backdrop-blur-xl">
            <Check className="size-4 text-brand" />
            {toast}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
