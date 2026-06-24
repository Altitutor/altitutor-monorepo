'use client'

import { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button, paginationPageActiveStyles, paginationPageInactiveStyles } from '@altitutor/ui'
import { getTruncatedPageNumbers } from '@/features/ucat/shared/lib/ucat-catalog-pagination'
import { cn } from '@/shared/utils'
import { tutorBtnOutline } from '@/shared/lib/tutor-visual'

type UcatCatalogPaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  className?: string
  maxVisiblePages?: number
}

export function UcatCatalogPagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
  maxVisiblePages = 5,
}: UcatCatalogPaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(Math.max(page, 1), pageCount)

  const pages = useMemo(
    () => getTruncatedPageNumbers(currentPage, pageCount, maxVisiblePages),
    [currentPage, pageCount, maxVisiblePages],
  )

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pageCount && newPage !== currentPage) {
      onPageChange(newPage)
    }
  }

  if (pageCount <= 1) {
    return null
  }

  return (
    <nav
      aria-label="Pagination"
      className={cn('flex items-center justify-center gap-1', className)}
    >
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(tutorBtnOutline, 'size-8')}
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      {pages.map((item, index) =>
        item === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="px-1 text-xs text-muted-foreground">
            …
          </span>
        ) : (
          <Button
            key={item}
            type="button"
            variant="ghost"
            size="sm"
            className={cn(
              'size-8 min-w-8 p-0 text-xs tabular-nums',
              item === currentPage ? paginationPageActiveStyles : paginationPageInactiveStyles,
            )}
            onClick={() => handlePageChange(item)}
            aria-label={`Page ${item}`}
            aria-current={item === currentPage ? 'page' : undefined}
          >
            {item}
          </Button>
        ),
      )}

      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn(tutorBtnOutline, 'size-8')}
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage >= pageCount}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  )
}
