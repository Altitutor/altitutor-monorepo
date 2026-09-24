'use client'

import { SetStatusSpan } from '@/features/ucat/shared/components/SetStatusSpan'
import type { MockSetColumnRow } from '@/features/ucat/shared/lib/mock-sets-column-display'
import { cn } from '@/shared/utils'

const setIssueClassName = {
  none: 'text-brand-darkBlue hover:underline dark:text-white',
  partial: 'text-amber-600 hover:underline dark:text-amber-500',
  structural: 'text-red-600 hover:underline dark:text-red-500',
} as const

type MockSetsColumnCellProps = {
  rows: MockSetColumnRow[] | null
  isLoading?: boolean
  onOpenSet: (setId: string) => void
}

export function MockSetsColumnCell({ rows, isLoading = false, onOpenSet }: MockSetsColumnCellProps) {
  if (isLoading || rows == null) {
    return <span className="text-xs text-muted-foreground">Loading sets...</span>
  }

  if (rows.length === 0) {
    return <span className="text-muted-foreground">—</span>
  }

  return (
    <div className="space-y-0.5">
      {rows.map((row, index) => {
        if (row.kind === 'gap') {
          return (
            <SetStatusSpan key={`gap-${index}`} status="mismatch" tooltip={row.tooltip}>
              <span className="block max-w-full truncate rounded px-1.5 py-0.5 text-xs bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400">
                {row.label}
              </span>
            </SetStatusSpan>
          )
        }

        return (
          <SetStatusSpan
            key={row.setId}
            status={row.issue === 'partial' ? 'partial' : row.issue === 'structural' ? 'mismatch' : 'match'}
            tooltip={row.tooltip}
          >
            <button
              type="button"
              className={cn(
                'block max-w-full truncate text-left text-sm underline-offset-2',
                setIssueClassName[row.issue],
              )}
              title={row.name}
              onClick={(event) => {
                event.stopPropagation()
                onOpenSet(row.setId)
              }}
            >
              {row.name}
            </button>
          </SetStatusSpan>
        )
      })}
    </div>
  )
}
