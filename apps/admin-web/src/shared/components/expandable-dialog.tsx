'use client'

import { Button } from '@altitutor/ui'
import { Maximize2, Minimize2 } from 'lucide-react'
import { cn } from '@/shared/utils'

/** Apply to DialogContent for smooth expand/collapse animation */
export const EXPANDABLE_DIALOG_TRANSITION =
  'transition-[width,height,max-width] duration-300 ease-in-out'

/**
 * Expanded state: keep centered (left/top/transform unchanged), only change width/height.
 * Avoids position jump when collapsing (right/bottom -> auto caused top-left flash).
 */
export const EXPANDED_DIALOG_CONTENT_CLASS =
  '!left-[50%] !top-[50%] !-translate-x-1/2 !-translate-y-1/2 !right-auto !bottom-auto !w-[calc(100vw-2rem)] !h-[calc(100dvh-2rem)] !max-w-none'

export function ExpandButton({
  expanded,
  onToggle,
  className,
}: {
  expanded: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={onToggle}
      title={expanded ? 'Exit full screen' : 'Full screen'}
      className={cn('shrink-0', className)}
    >
      {expanded ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </Button>
  )
}
