'use client'

import { useState, useEffect, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@altitutor/ui'
import { UcatRichTextToolbar } from '@/features/ucat/shared/components/UcatRichTextToolbar'
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
  footerActions,
  headerActions,
  warningPills,
  defaultExpanded = false,
  mobileFullscreen = false,
  richTextToolbarEditor = null,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  onSave?: () => void
  saveLabel?: string
  saveDisabled?: boolean
  isSaving?: boolean
  hideCancel?: boolean
  footerActions?: ReactNode
  headerActions?: ReactNode
  warningPills?: string[]
  defaultExpanded?: boolean
  /** Make dense authoring workspaces use the whole viewport on phones. */
  mobileFullscreen?: boolean
  /** When set, renders the rich-text toolbar inline in the dialog footer beside action buttons. */
  richTextToolbarEditor?: Editor | null
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  useEffect(() => {
    if (open) {
      setExpanded(defaultExpanded)
    } else {
      setExpanded(false)
    }
  }, [open, defaultExpanded])

  const expandedContentClass = expanded ? EXPANDED_DIALOG_CONTENT_CLASS : ''

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent
        className={cn(
          'flex h-[90vh] w-full flex-col gap-0 p-0 sm:!h-[90vh] md:max-w-4xl [&>button]:hidden',
          mobileFullscreen && 'max-w-none rounded-none !h-[100dvh] !w-screen sm:!h-[90vh] sm:!w-full sm:max-w-4xl sm:!rounded-2xl',
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
                <DialogDescription className={cn(!subtitle && 'sr-only', subtitle && 'mt-1')}>
                  {subtitle ?? title}
                </DialogDescription>
                {warningPills && warningPills.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {warningPills.map((warning) => (
                      <Badge key={warning} variant="outline" className="border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                        {warning}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ExpandButton expanded={expanded} onToggle={() => setExpanded((e) => !e)} />
              {headerActions ? headerActions : null}
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 flex-col overflow-hidden">{children}</div>

        <DialogFooter
          className={cn(
            'flex-shrink-0 flex-row items-center gap-3 px-6 py-4 sm:justify-start',
            tutorDialogFooterStrip,
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {richTextToolbarEditor ? (
              <div className="min-w-0 flex-1 overflow-x-auto" data-rich-text-toolbar>
                <UcatRichTextToolbar editor={richTextToolbarEditor} />
              </div>
            ) : null}
            <div className={cn('flex shrink-0 items-center gap-2', !richTextToolbarEditor && 'ml-auto')}>
              {footerActions ? footerActions : null}
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
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
