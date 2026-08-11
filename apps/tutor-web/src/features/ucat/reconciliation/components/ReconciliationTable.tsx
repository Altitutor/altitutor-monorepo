'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
  Badge,
  Checkbox,
} from '@altitutor/ui'
import { cn } from '@/shared/utils'
import { tutorTableBodyRow, tutorTableHeaderRow, tutorTableShell } from '@/shared/lib/tutor-visual'

interface ReconciliationTableProps<T> {
  title: string
  description?: string
  /** When false, the count badge next to the title is hidden (e.g. counts live on subtype tabs). */
  showCountBadge?: boolean
  items: T[]
  isLoading?: boolean
  renderRow: (item: T, index: number, visibleColumnKeys: string[], selection?: ReconciliationTableProps<T>['selection']) => React.ReactNode
  columnDefinitions: Array<{ key: string; label: string }>
  visibleColumnKeys: string[]
  toolbar?: React.ReactNode
  headerActions?: React.ReactNode
  pagination?: {
    page: number
    pageSize: number
    total: number
    onPageChange: (page: number) => void
    onPageSizeChange: (pageSize: number) => void
  }
  /** Selection support - when provided, shows checkbox column and enables row selection */
  selection?: {
    getItemId: (item: T) => string
    selectedIds: Set<string>
    onToggleSelection: (id: string) => void
    onToggleSelectAll: () => void
    allVisibleSelected: boolean
    someVisibleSelected: boolean
  }
}

export function ReconciliationTable<T>({
  title,
  description,
  showCountBadge = true,
  items,
  isLoading = false,
  renderRow,
  columnDefinitions,
  visibleColumnKeys,
  toolbar,
  headerActions,
  selection,
  pagination,
}: ReconciliationTableProps<T>) {
  const columns = columnDefinitions
    .filter((c) => visibleColumnKeys.includes(c.key))
    .map((c) => c.label)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const activePage = pagination?.page ?? page
  const activePageSize = pagination?.pageSize ?? pageSize
  const totalItems = pagination?.total ?? items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const pagedItems = useMemo(() => {
    if (pagination) return items
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize, pagination])

  useEffect(() => {
    if (!pagination && page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages, pagination])

  const selectionMode = selection && selection.selectedIds.size > 0

  return (
    <div className={cn('space-y-4', selectionMode && 'pb-24')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{title}</h3>
            {showCountBadge ? (
              <Badge
                variant={totalItems === 0 ? 'secondary' : 'destructive'}
                className={totalItems === 0 ? 'bg-accent text-accent-foreground' : undefined}
              >
                {totalItems}
              </Badge>
            ) : null}
          </div>
          {description ? (
            <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
      </div>

      <div className="space-y-4">
        {toolbar ? <div>{toolbar}</div> : null}

        <div className={tutorTableShell}>
          <Table>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className={tutorTableHeaderRow}>
                {selection && (
                  <TableHead className="w-12" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection.allVisibleSelected ? true : selection.someVisibleSelected ? 'indeterminate' : false}
                      onCheckedChange={selection.onToggleSelectAll}
                      aria-label="Select all visible rows"
                    />
                  </TableHead>
                )}
                {columns.map((col) => (
                  <TableHead key={col}>{col}</TableHead>
                ))}
                <TableHead className="w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow className={tutorTableBodyRow}>
                  <TableCell colSpan={columns.length + (selection ? 2 : 1)} className="text-center h-24">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow className={tutorTableBodyRow}>
                  <TableCell colSpan={columns.length + (selection ? 2 : 1)} className="text-center h-24 text-muted-foreground">
                    No items found
                  </TableCell>
                </TableRow>
              ) : (
                pagedItems.map((item, index) => {
                  const absoluteIndex = (activePage - 1) * activePageSize + index
                  return renderRow(item, absoluteIndex, visibleColumnKeys, selection)
                })
              )}
            </TableBody>
          </Table>
        </div>

        {!isLoading && totalItems > 0 ? (
          <TablePagination
            page={activePage}
            pageSize={activePageSize}
            total={totalItems}
            onPageChange={pagination?.onPageChange ?? setPage}
            onPageSizeChange={(newPageSize) => {
              if (pagination) {
                pagination.onPageSizeChange(newPageSize)
                return
              }
              setPageSize(newPageSize)
              setPage(1)
            }}
          />
        ) : null}
      </div>
    </div>
  )
}
