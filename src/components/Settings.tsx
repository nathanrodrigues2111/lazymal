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
          <DrawerTitle>Your taste~</DrawerTitle>
          <DrawerDescription className="mt-1">
            lazymal gently highlights this season’s anime that match your
            favorite genres.
          </DrawerDescription>

          <div className="mt-5">
            <GenrePicker selected={genres} onToggle={toggle} />
          </div>

          <div className="mt-6">
            <Button
              className="w-full rounded-full"
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
