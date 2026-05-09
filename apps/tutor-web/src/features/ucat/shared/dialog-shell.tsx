'use client'

import { useState, useEffect } from 'react'
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@altitutor/ui'
import { X } from 'lucide-react'
import {
  ExpandButton,
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
} from '@/shared/components/expandable-dialog'
import { cn } from '@/shared/utils'
import {
  tutorBtnIconOutline,
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorDialogContentClass,
  tutorDialogFooterStrip,
  tutorDialogHeaderStrip,
} from '@/shared/lib/tutor-visual'

export function UcatDialogShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  onSave,
  saveLabel = 'Save',
  saveDisabled,
  isSaving,
  hideCancel = false,
  headerActions,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
  onSave?: () => void
  saveLabel?: string
  saveDisabled?: boolean
  isSaving?: boolean
  hideCancel?: boolean
  headerActions?: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!open) setExpanded(false)
  }, [open])

  const expandedContentClass = expanded ? EXPANDED_DIALOG_CONTENT_CLASS : ''

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent
        className={cn(
          'flex h-[90vh] w-full flex-col gap-0 p-0 md:max-w-4xl [&>button]:hidden',
          tutorDialogContentClass,
          EXPANDABLE_DIALOG_TRANSITION,
          expandedContentClass,
        )}
      >
        <DialogHeader className={cn('flex-shrink-0 px-6 py-4', tutorDialogHeaderStrip)}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-1 items-center gap-3">
              <Button variant="outline" size="icon" onClick={onClose} className={tutorBtnIconOutline}>
                <X className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <DialogTitle>{title}</DialogTitle>
                {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
              {headerActions ? headerActions : null}
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">{children}</div>

        <DialogFooter className={cn('flex-shrink-0 px-6 py-4', tutorDialogFooterStrip)}>
          <div className="flex w-full items-center justify-end gap-2">
            {!hideCancel ? (
              <Button type="button" variant="outline" className={tutorBtnOutline} onClick={onClose}>
                Cancel
              </Button>
            ) : null}
            {onSave ? (
              <Button
                type="button"
                className={tutorBtnPrimary}
                onClick={onSave}
                disabled={saveDisabled || isSaving}
              >
                {isSaving ? 'Saving...' : saveLabel}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
