'use client'

import { useCallback } from 'react'
import { useToast } from '@altitutor/ui'

export function useUcatCopyId() {
  const { toast } = useToast()

  const copyId = useCallback(
    async (id: string) => {
      if (!id) return
      try {
        await navigator.clipboard.writeText(id)
        toast({
          title: 'Copied',
          description: 'ID copied to clipboard',
        })
      } catch {
        toast({
          title: 'Failed to copy',
          description: 'Please try again',
          variant: 'destructive',
        })
      }
    },
    [toast],
  )

  return { copyId }
}
