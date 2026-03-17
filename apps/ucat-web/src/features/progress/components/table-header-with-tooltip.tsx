'use client'

import { Info } from 'lucide-react'
import {
  TableHead,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@altitutor/ui'

type TableHeaderWithTooltipProps = {
  children: React.ReactNode
  tooltip?: string
}

/** Table header with optional info icon and tooltip. Omit tooltip for name/date columns. */
export function TableHeaderWithTooltip({
  children,
  tooltip,
}: TableHeaderWithTooltipProps) {
  return (
    <TableHead>
      <span className="inline-flex items-center gap-1">
        {children}
        {tooltip != null && (
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
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </span>
    </TableHead>
  )
}
