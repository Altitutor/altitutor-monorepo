'use client'

import { useState } from 'react'
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@altitutor/ui'
import { Sparkles } from 'lucide-react'
import { cn } from '@/shared/utils'

function DetectionValue({ label, value, highlighted = false }: {
  label: string
  value: string
  highlighted?: boolean
}) {
  return (
    <div className={cn(
      'rounded-md border px-3 py-2',
      highlighted
        ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40'
        : 'border-border bg-muted/30',
    )}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}

export function UcatDetectedStemMetadataPill({
  propertyLabel,
  value,
  currentValue,
  detectedValue,
  explanation,
  confidence,
  evidence = [],
  conflicts = [],
  acceptLabel = 'Accept',
  onAccept,
  onDismiss,
  className,
}: {
  propertyLabel: string
  value: string
  currentValue: string
  detectedValue: string
  explanation: string
  confidence?: string | null
  evidence?: string[]
  conflicts?: string[]
  acceptLabel?: string
  onAccept?: () => void
  onDismiss: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)

  function handleAccept() {
    setOpen(false)
    onAccept?.()
  }

  function handleReject() {
    setOpen(false)
    onDismiss()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex w-full max-w-full items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-left text-xs text-amber-950 transition-colors hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100 dark:hover:bg-amber-950/70',
            className,
          )}
          aria-label={`Review detected ${propertyLabel.toLowerCase()} suggestion: ${value}`}
        >
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate" title={value}>
            Detected: <span className="font-medium">{value}</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        enableModalScroll
        className="z-[100] w-[360px] max-w-[calc(100vw-24px)] space-y-3 p-4"
      >
        <div>
          <p className="text-sm font-semibold text-foreground">Detected {propertyLabel.toLowerCase()}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{explanation}</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <DetectionValue label="Current" value={currentValue} />
          <DetectionValue label="Detected" value={detectedValue} highlighted />
        </div>

        {confidence ? (
          <div className="text-xs">
            <span className="text-muted-foreground">Confidence: </span>
            <span className="font-medium capitalize text-foreground">{confidence}</span>
          </div>
        ) : null}

        {evidence.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-foreground">What was detected</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
              {evidence.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : null}

        {conflicts.length > 0 ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
            <p className="text-xs font-medium text-destructive">Conflicting signals</p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
              {conflicts.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" size="sm" onClick={handleReject}>
            Reject
          </Button>
          {onAccept ? (
            <Button type="button" size="sm" onClick={handleAccept}>
              {acceptLabel}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
