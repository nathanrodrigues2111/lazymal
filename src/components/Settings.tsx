import { Trash2 } from 'lucide-react'

import { usePrefs } from '@/store/usePrefs'
import { GenrePicker } from '@/components/GenrePicker'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function Settings({ open, onOpenChange }: Props) {
  const genres = usePrefs((s) => s.genres)
  const setGenres = usePrefs((s) => s.setGenres)
  const starredCount = usePrefs((s) => s.starred.length)
  const clearStars = usePrefs((s) => s.clearStars)

  const toggle = (name: string) =>
    setGenres(
      genres.includes(name)
        ? genres.filter((g) => g !== name)
        : [...genres, name],
    )

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="overflow-y-auto overscroll-contain px-5 pb-8 pt-4">
          <DrawerTitle>Your taste</DrawerTitle>
          <DrawerDescription className="mt-1">
            LazyMAL highlights this season's anime that match your favorite
            genres.
          </DrawerDescription>

          <div className="mt-5">
            <GenrePicker selected={genres} onToggle={toggle} />
          </div>

          <div className="mt-6 flex gap-3">
            {starredCount > 0 && (
              <Button
                variant="secondary"
                className="flex-1 rounded-full"
                onClick={clearStars}
              >
                <Trash2 className="size-4" />
                Clear favorites ({starredCount})
              </Button>
            )}
            <Button
              className="flex-[2] rounded-full"
              size="lg"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
