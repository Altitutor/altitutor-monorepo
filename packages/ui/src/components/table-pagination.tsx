'use client';

import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { cn } from '../lib/cn';

export interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  isFetching?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const MAX_VISIBLE_PAGES = 7;

export function TablePagination({
  page,
  pageSize,
  total,
  isFetching = false,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  className,
}: TablePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);

  const pages = useMemo(() => {
    if (pageCount <= MAX_VISIBLE_PAGES) {
      return Array.from({ length: pageCount }, (_, index) => index + 1);
    }

    const pagesList: Array<number | 'ellipsis'> = [];
    const showLeftEllipsis = currentPage > 4;
    const showRightEllipsis = currentPage < pageCount - 3;

    const addRange = (start: number, end: number) => {
      for (let i = start; i <= end; i += 1) {
        pagesList.push(i);
      }
    };

    pagesList.push(1);
    if (showLeftEllipsis) {
      pagesList.push('ellipsis');
    }

    const start = showLeftEllipsis ? currentPage - 1 : 2;
    const end = showRightEllipsis ? currentPage + 1 : pageCount - 1;
    addRange(start, end);

    if (showRightEllipsis) {
      pagesList.push('ellipsis');
    }
    pagesList.push(pageCount);

    return pagesList;
  }, [currentPage, pageCount]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pageCount && newPage !== currentPage) {
      onPageChange(newPage);
    }
  };

  const handlePageSizeChange = (value: string) => {
    const newSize = Number(value);
    if (Number.isFinite(newSize) && newSize > 0 && newSize !== pageSize) {
      onPageSizeChange(newSize);
    }
  };

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-muted-foreground', className)}>
      <div className="flex items-center gap-2">
        <span>
          Page {currentPage} of {pageCount} • {total} total
        </span>
        {isFetching && <span className="text-xs">(Refreshing...)</span>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="w-[80px]">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent align="end">
              {pageSizeOptions.map((sizeOption) => (
                <SelectItem key={sizeOption} value={String(sizeOption)}>
                  {sizeOption}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1">
            {pages.map((item, index) =>
              item === 'ellipsis' ? (
                <span key={`ellipsis-${index}`} className="px-2">
                  …
                </span>
              ) : (
                <Button
                  key={item}
                  variant={item === currentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePageChange(item)}
                  className="min-w-[36px]"
                >
                  {item}
                </Button>
              ),
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= pageCount}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
