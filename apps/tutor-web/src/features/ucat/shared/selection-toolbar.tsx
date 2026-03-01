'use client'

import { Button } from '@altitutor/ui'
import { Trash2, X } from 'lucide-react'
import { cn } from '@/shared/utils'

export function UcatSelectionToolbar({
  selectedCount,
  onCancel,
  onDelete,
  deletePending,
  children,
  className,
}: {
  selectedCount: number
  onCancel: () => void
  onDelete: () => void
  deletePending?: boolean
  children?: React.ReactNode
  className?: string
}) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 border-t bg-background px-4 py-3 shadow-lg',
        'safe-area-pb',
        className
      )}
      style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
    >
      <span className="text-sm font-medium text-muted-foreground">
        {selectedCount} selected
      </span>
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {children}
      </div>
      <div className="flex items-center gap-2">
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
        <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel selection">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
