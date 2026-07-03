'use client'

import { Badge, getUcatVisibilityColor } from '@altitutor/ui'
import { cn } from '@/shared/utils'

type UcatVisibilityBadgeProps = {
  isPrivate: boolean
  className?: string
}

export function UcatVisibilityBadge({ isPrivate, className }: UcatVisibilityBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] font-normal px-1.5 py-0', getUcatVisibilityColor(isPrivate), className)}
    >
      {isPrivate ? 'Private' : 'Public'}
    </Badge>
  )
}
