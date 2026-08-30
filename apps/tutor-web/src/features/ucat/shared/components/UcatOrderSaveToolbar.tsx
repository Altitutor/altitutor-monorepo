'use client'

import { useEffect } from 'react'
import { Button } from '@altitutor/ui'
import { Save, X } from 'lucide-react'
import { tutorBtnOutline, tutorBtnPrimary } from '@/shared/lib/tutor-visual'

const UNSAVED_ORDER_MESSAGE =
  'You have unsaved order changes. Discard them and leave?'

export function useUnsavedOrderWarning(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a[href]')
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download')
      )
        return
      if (window.confirm(UNSAVED_ORDER_MESSAGE)) return
      event.preventDefault()
      event.stopPropagation()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('click', handleDocumentClick, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('click', handleDocumentClick, true)
    }
  }, [isDirty])
}

export function confirmDiscardUnsavedOrder(isDirty: boolean): boolean {
  return !isDirty || window.confirm(UNSAVED_ORDER_MESSAGE)
}

export function UcatOrderSaveToolbar({
  isDirty,
  isSaving,
  onSave,
  onCancel,
}: {
  isDirty: boolean
  isSaving: boolean
  onSave: () => void
  onCancel: () => void
}) {
  if (!isDirty) return null

  return (
    <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-center gap-3 rounded-lg border bg-popover px-4 py-2 shadow-lg">
      <span className="min-w-0 flex-1 text-sm font-medium text-muted-foreground">
        Unsaved order changes
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={tutorBtnOutline}
        disabled={isSaving}
        onClick={onCancel}
      >
        <X className="mr-1.5 h-4 w-4" />
        Cancel
      </Button>
      <Button
        type="button"
        size="sm"
        className={tutorBtnPrimary}
        disabled={isSaving}
        onClick={onSave}
      >
        <Save className="mr-1.5 h-4 w-4" />
        {isSaving ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}
