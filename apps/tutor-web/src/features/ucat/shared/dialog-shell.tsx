'use client'

import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@altitutor/ui'
import { X } from 'lucide-react'

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
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
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
            {headerActions ? <div className="flex-shrink-0">{headerActions}</div> : null}
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
