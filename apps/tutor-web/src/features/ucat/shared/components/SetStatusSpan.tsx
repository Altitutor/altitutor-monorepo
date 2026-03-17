'use client'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui'
import { cn } from '@/shared/utils'
import type { UcatExamStatus, TimeLimitStatus } from '@/features/ucat/shared/lib/set-section-status'

/** Centralized status colors: green = match, orange = partial, red = mismatch, yellow = untimed */
const statusColors: Record<UcatExamStatus, string> = {
  match: 'text-green-600 dark:text-green-500',
  partial: 'text-amber-600 dark:text-amber-500',
  mismatch: 'text-red-600 dark:text-red-500',
}

/** Timing-specific: untimed = yellow */
const timeLimitStatusColors: Record<TimeLimitStatus, string> = {
  ...statusColors,
  untimed: 'text-yellow-600 dark:text-yellow-500',
}

/** For set-level status: 'mismatch' maps to orange (partial) for backward compatibility */
type SetStatus = 'match' | 'mismatch'

const setStatusToColor: Record<SetStatus, string> = {
  match: statusColors.match,
  mismatch: statusColors.partial,
}

type SetStatusSpanProps = {
  /** Use for set-level (sections, questions, timing) or mock-level status */
  status: UcatExamStatus | SetStatus | TimeLimitStatus
  tooltip: string
  children: React.ReactNode
  className?: string
}

export function SetStatusSpan({ status, tooltip, children, className }: SetStatusSpanProps) {
  const colorClass =
    status in timeLimitStatusColors
      ? timeLimitStatusColors[status as TimeLimitStatus]
      : status in statusColors
        ? statusColors[status as UcatExamStatus]
        : setStatusToColor[status as SetStatus]
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('cursor-help', colorClass, className)}>{children}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
