'use client'

import { Info } from 'lucide-react'
import { cn } from '@/shared/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@altitutor/ui'

type SegmentedControlOption<T> = {
  value: T
  label: string
  infoTooltip?: string
}

type SegmentedControlProps<T extends string> = {
  value: T
  onValueChange: (value: T) => void
  options: SegmentedControlOption<T>[]
  className?: string
}

/** Matches the set generator page tab selector style. */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex rounded-lg border border-border bg-muted p-0.5 text-xs',
        className
      )}
      role="tablist"
    >
      {options.map((option) => {
        const isActive = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors',
              isActive
                ? 'bg-sidebar text-sidebar-foreground'
                : 'text-foreground hover:bg-muted/80'
            )}
          >
            {option.label}
            {option.infoTooltip && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex text-muted-foreground hover:text-foreground cursor-help"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Info className="h-3 w-3" aria-hidden />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[240px]">
                    {option.infoTooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </button>
        )
      })}
    </div>
  )
}
