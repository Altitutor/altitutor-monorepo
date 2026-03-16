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
          'w-full md:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden',
          EXPANDABLE_DIALOG_TRANSITION,
          expandedContentClass
        )}
      >
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Button variant="outline" size="icon" onClick={onClose} className="shrink-0">
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

        <div className="flex-1 overflow-hidden min-h-0">{children}</div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <div className="flex items-center gap-2 w-full justify-end">
            {!hideCancel ? (
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
            ) : null}
            {onSave ? (
              <Button type="button" onClick={onSave} disabled={saveDisabled || isSaving}>
                {isSaving ? 'Saving...' : saveLabel}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
