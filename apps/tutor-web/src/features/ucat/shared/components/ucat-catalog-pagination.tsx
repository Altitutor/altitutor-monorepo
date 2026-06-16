'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, SearchableSelect } from '@altitutor/ui'
import { cn } from '@/shared/utils'
import { tutorBtnOutline } from '@/shared/lib/tutor-visual'

type UcatCatalogPaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  pageSizeOptions?: number[]
  className?: string
}

export function UcatCatalogPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  className,
}: UcatCatalogPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(page, 1), pageCount)

  type PageSizeItem = { value: number }
  const pageSizeItems: PageSizeItem[] = pageSizeOptions.map((value) => ({ value }))
  const selectedPageSize = pageSizeItems.find((item) => item.value === pageSize) ?? pageSizeItems[0]

  return (
    <div
      className={cn(
        'flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <span className="tabular-nums">
        {total} {total === 1 ? 'item' : 'items'} · Page {currentPage} of {pageCount}
      </span>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <div className="flex items-center gap-1.5">
          <span className="whitespace-nowrap">Per page</span>
          <SearchableSelect<PageSizeItem>
            items={pageSizeItems}
            value={selectedPageSize}
            onValueChange={(item) => item && onPageSizeChange(item.value)}
            getItemLabel={(item) => String(item.value)}
            getItemId={(item) => String(item.value)}
            triggerClassName="!h-8 !w-[4.25rem] min-w-0 shrink-0 text-xs"
          />
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(tutorBtnOutline, 'size-8')}
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn(tutorBtnOutline, 'size-8')}
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= pageCount}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
