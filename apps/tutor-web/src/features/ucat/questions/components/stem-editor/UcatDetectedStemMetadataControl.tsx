'use client'

import { Check, Sparkles, X } from 'lucide-react'
import { cn } from '@/shared/utils'

export function UcatDetectedStemMetadataPill({
  value,
  onAccept,
  onDismiss,
  className,
}: {
  value: string
  onAccept?: () => void
  onDismiss: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex max-w-full items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 py-1 pl-2.5 pr-1 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100',
        className,
      )}
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1 truncate" title={value}>
        Detected: <span className="font-medium">{value}</span>
      </span>
      {onAccept ? (
        <button
          type="button"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-amber-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:hover:bg-amber-900/70"
          onClick={onAccept}
          aria-label={`Accept detected ${value}`}
          title="Accept"
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-amber-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:hover:bg-amber-900/70"
        onClick={onDismiss}
        aria-label={`Dismiss detected ${value}`}
        title="Dismiss"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  )
}
