'use client'

import { Badge, getUcatContentStatusColor } from '@altitutor/ui'
import {
  UCAT_CONTENT_STATUS_OPTIONS,
  type UcatContentStatus,
} from '@/features/ucat/shared/types'
import { cn } from '@/shared/utils'

type UcatContentStatusBadgeProps = {
  status: UcatContentStatus
  className?: string
}

export function UcatContentStatusBadge({ status, className }: UcatContentStatusBadgeProps) {
  const label =
    UCAT_CONTENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status

  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] font-normal px-1.5 py-0', getUcatContentStatusColor(status), className)}
    >
      {label}
    </Badge>
  )
}
