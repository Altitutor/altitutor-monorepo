'use client'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@altitutor/ui'

const COMING_SOON_MESSAGE =
  'This feature is still in development. We are working hard to get it ready for you soon.'

type ComingSoonModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ComingSoonModal({ open, onOpenChange }: ComingSoonModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Coming soon</AlertDialogTitle>
          <AlertDialogDescription>{COMING_SOON_MESSAGE}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>OK</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
