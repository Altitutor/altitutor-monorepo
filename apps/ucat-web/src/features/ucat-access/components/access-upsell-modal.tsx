'use client'

import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@altitutor/ui'
import type { RequiredUcatAccess } from '@/features/ucat-access/lib/route-access'

type AccessUpsellModalProps = {
  open: boolean
  requiredAccess: RequiredUcatAccess | null
  onOpenChange: (open: boolean) => void
}

export function AccessUpsellModal({
  open,
  requiredAccess,
  onOpenChange,
}: AccessUpsellModalProps) {
  const router = useRouter()

  if (!requiredAccess) return null

  const isOnline = requiredAccess === 'online'
  const title = isOnline ? 'Unlock online UCAT access' : 'Join in-person UCAT classes'
  const description = isOnline
    ? 'Subscribe to access Learn, Practice, Sets, and Mocks. Keep your in-person classes and add full online practice.'
    : 'You can add in-person UCAT classes for guided sessions with your tutor. Keep your online subscription and combine both.'
  const ctaLabel = isOnline ? 'View pricing' : 'Contact us'
  const ctaHref = isOnline ? '/pricing' : 'mailto:support@altitutor.com.au'

  const handlePrimaryAction = () => {
    onOpenChange(false)
    if (ctaHref.startsWith('mailto:')) {
      window.location.href = ctaHref
      return
    }
    router.push(ctaHref)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => onOpenChange(false)}>Maybe later</AlertDialogAction>
          <AlertDialogAction onClick={handlePrimaryAction}>{ctaLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
