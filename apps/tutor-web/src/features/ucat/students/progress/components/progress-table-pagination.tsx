'use client'

import { TablePagination } from '@altitutor/ui'
import { cn } from '@/shared/utils'

type ProgressTablePaginationProps = React.ComponentProps<typeof TablePagination>

/** TablePagination with padding and ucat accent styling for the active page button. */
export function ProgressTablePagination({
  className,
  ...props
}: ProgressTablePaginationProps) {
  return (
    <div className={cn('pt-4 ucat-pagination', className)}>
      <TablePagination {...props} />
    </div>
  )
}
