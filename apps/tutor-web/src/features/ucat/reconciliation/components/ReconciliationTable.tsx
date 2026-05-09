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
  Button,
  Badge,
  Checkbox,
} from '@altitutor/ui'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/shared/utils'
import { tutorTableBodyRow, tutorTableHeaderRow, tutorTableShell } from '@/shared/lib/tutor-visual'

interface ReconciliationTableProps<T> {
  title: string
  items: T[]
  isLoading?: boolean
  renderRow: (item: T, index: number, visibleColumnKeys: string[], selection?: ReconciliationTableProps<T>['selection']) => React.ReactNode
  columnDefinitions: Array<{ key: string; label: string }>
  visibleColumnKeys: string[]
  toolbar?: React.ReactNode
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
  items,
  isLoading = false,
  renderRow,
  columnDefinitions,
  visibleColumnKeys,
  toolbar,
  selection,
}: ReconciliationTableProps<T>) {
  const columns = columnDefinitions
    .filter((c) => visibleColumnKeys.includes(c.key))
    .map((c) => c.label)
  const [isExpanded, setIsExpanded] = useState(items.length > 0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const totalItems = items.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const pagedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages)
    }
  }, [page, totalPages])

  const selectionMode = selection && selection.selectedIds.size > 0

  return (
    <div className={cn('space-y-4', selectionMode && 'pb-24')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-lg"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform duration-300 ease-out motion-reduce:transition-none',
                isExpanded ? 'rotate-0' : '-rotate-90',
              )}
            />
          </Button>
          <h3 className="text-lg font-semibold">{title}</h3>
          <Badge
            variant={items.length === 0 ? 'secondary' : 'destructive'}
            className={items.length === 0 ? 'bg-accent text-accent-foreground' : undefined}
          >
            {items.length}
          </Badge>
        </div>
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none',
          isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-4 pt-2">
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
                      const absoluteIndex = (page - 1) * pageSize + index
                      return renderRow(item, absoluteIndex, visibleColumnKeys, selection)
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {!isLoading && totalItems > 0 ? (
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={totalItems}
                onPageChange={setPage}
                onPageSizeChange={(newPageSize) => {
                  setPageSize(newPageSize)
                  setPage(1)
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
