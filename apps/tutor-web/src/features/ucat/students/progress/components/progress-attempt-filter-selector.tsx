'use client'

import { Info } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@altitutor/ui'
import { cn } from '@/shared/utils'
import {
  type AttemptFilter,
  ATTEMPT_FILTER_OPTIONS,
} from '../lib/progress-mode'

type ProgressAttemptFilterSelectorProps = {
  value: AttemptFilter
  onValueChange: (value: AttemptFilter) => void
  className?: string
}

export function ProgressAttemptFilterSelector({
  value,
  onValueChange,
  className,
}: ProgressAttemptFilterSelectorProps) {
  const selectedOption = ATTEMPT_FILTER_OPTIONS.find((o) => o.value === value)

  return (
    <div className={cn(className, 'flex items-center gap-1')}>
      <Select value={value} onValueChange={(v) => onValueChange(v as AttemptFilter)}>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Filter" />
        </SelectTrigger>
        <SelectContent>
          {ATTEMPT_FILTER_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {selectedOption && (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex text-muted-foreground hover:text-foreground cursor-help">
                <Info className="h-3.5 w-3.5" aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="z-[100] max-w-[260px]">
              {selectedOption.infoTooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
