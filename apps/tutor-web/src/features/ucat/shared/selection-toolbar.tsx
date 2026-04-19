'use client'

import { Button } from '@altitutor/ui'
import { Trash2, X } from 'lucide-react'
import { cn } from '@/shared/utils'

export function UcatSelectionToolbar({
  selectedCount,
  onCancel,
  onDelete,
  deletePending,
  hideDelete,
  children,
  className,
}: {
  selectedCount: number
  onCancel: () => void
  onDelete?: () => void
  deletePending?: boolean
  /** When true, hide the Delete button (e.g. when only bulk add category is needed) */
  hideDelete?: boolean
  children?: React.ReactNode
  className?: string
}) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        'fixed left-1/2 z-50 -translate-x-1/2',
        'bottom-[max(1.5rem,env(safe-area-inset-bottom))]',
        'max-w-3xl w-[calc(100%-2rem)]',
        'flex items-center gap-3 rounded-lg border bg-popover px-4 py-2 shadow-lg',
        className
      )}
    >
      <span className="text-sm font-medium text-muted-foreground shrink-0">
        {selectedCount} selected
      </span>
      <div className="flex flex-1 flex-wrap items-center justify-center gap-2 min-w-0">
        {children}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {!hideDelete && onDelete && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={deletePending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 dark:bg-destructive dark:text-destructive-foreground dark:hover:bg-destructive/90"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel selection">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
