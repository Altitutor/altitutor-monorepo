'use client'

import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui'
import { cn } from '@/shared/utils'
import { UCAT_VISIBILITY_TOOLTIP } from '@/features/ucat/shared/lib/visibility-labels'

type UcatVisibilityInfoTooltipProps = {
  tooltip?: string
  iconClassName?: string
  contentClassName?: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  ariaLabel?: string
}

export function UcatVisibilityInfoTooltip({
  tooltip = UCAT_VISIBILITY_TOOLTIP,
  iconClassName,
  contentClassName,
  side = 'top',
  ariaLabel = 'Visibility info',
}: UcatVisibilityInfoTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex shrink-0 items-center justify-center text-muted-foreground hover:text-foreground',
              iconClassName,
            )}
            aria-label={ariaLabel}
            onClick={(event) => event.stopPropagation()}
          >
            <Info className="h-3.5 w-3.5" aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className={cn('max-w-xs text-xs leading-relaxed', contentClassName)}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function UcatVisibilityFieldLabel({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      Visibility
      <UcatVisibilityInfoTooltip iconClassName="h-4 w-4" side="left" />
    </span>
  )
}

export function UcatVisibilityTableHeaderLabel() {
  return (
    <span className="inline-flex items-center gap-1">
      Visibility
      <UcatVisibilityInfoTooltip side="bottom" />
    </span>
  )
}
