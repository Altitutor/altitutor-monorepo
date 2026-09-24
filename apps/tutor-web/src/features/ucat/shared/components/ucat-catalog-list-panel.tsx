'use client'

import type {
  DataTableColumnDefinition,
  DataTableFilterDefinition,
  DataTableSortOption,
} from '@altitutor/shared'
import { ListToolbar, Skeleton, TablePagination, type DataTableColumnViewGroup, type DataTableSearchFromOption } from '@altitutor/ui'
import {
  ucatCatalogToolbarClassName,
  ucatCatalogToolbarControlClassName,
  ucatCatalogToolbarRowClassName,
  ucatCatalogToolbarSearchContainerClassName,
  ucatCatalogToolbarSearchInputClassName,
} from '@/features/ucat/shared/lib/ucat-catalog-toolbar'
import { cn } from '@/shared/utils'

type UcatCatalogListPanelProps = {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  searchLeadingAccessory?: React.ReactNode
  searchFromOptions?: DataTableSearchFromOption[]
  searchFromValue?: string[]
  onSearchFromChange?: (values: string[]) => void
  filterDefinitions?: DataTableFilterDefinition[]
  filters?: Record<string, unknown[]>
  onFiltersChange?: (filters: Record<string, unknown[]>) => void
  filterSearchValues?: Record<string, string>
  onFilterSearchChange?: (filterKey: string, value: string) => void
  sortOptions?: DataTableSortOption[]
  sortBy?: string | null
  sortDirection?: 'asc' | 'desc'
  onSortChange?: (field: string | null, direction: 'asc' | 'desc') => void
  columnDefinitions?: DataTableColumnDefinition[]
  visibleColumns?: string[]
  onVisibleColumnsChange?: (columns: string[]) => void
  columnViewGroups?: DataTableColumnViewGroup[]
  defaultVisibleColumns?: string[]
  page?: number
  pageSize?: number
  total?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
  isLoading?: boolean
  emptyMessage: string
  hasItems: boolean
  hidePagination?: boolean
  compact?: boolean
  className?: string
  children: React.ReactNode
}

export function UcatCatalogListPanel({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  searchLeadingAccessory,
  searchFromOptions,
  searchFromValue,
  onSearchFromChange,
  filterDefinitions = [],
  filters = {},
  onFiltersChange = () => {},
  filterSearchValues,
  onFilterSearchChange,
  sortOptions = [],
  sortBy = null,
  sortDirection = 'desc',
  onSortChange,
  columnDefinitions = [],
  visibleColumns = [],
  onVisibleColumnsChange,
  columnViewGroups,
  defaultVisibleColumns,
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange = () => {},
  onPageSizeChange = () => {},
  pageSizeOptions = [10, 20, 50],
  isLoading = false,
  emptyMessage,
  hasItems,
  hidePagination = false,
  compact = true,
  className,
  children,
}: UcatCatalogListPanelProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const effectivePage = Math.min(Math.max(page, 1), pageCount)

  return (
    <div className={cn('flex h-full min-h-0 flex-1 flex-col', className)}>
      <div className="shrink-0 px-1 pb-2">
        <ListToolbar
          compact={compact}
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder}
          searchLeadingAccessory={searchLeadingAccessory}
          searchFromOptions={searchFromOptions}
          searchFromValue={searchFromValue}
          onSearchFromChange={onSearchFromChange}
          filterDefinitions={filterDefinitions}
          filters={filters}
          onFiltersChange={onFiltersChange}
          sortOptions={sortOptions}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSortChange={onSortChange}
          columnDefinitions={columnDefinitions}
          visibleColumns={visibleColumns}
          onVisibleColumnsChange={onVisibleColumnsChange}
          columnViewGroups={columnViewGroups}
          defaultVisibleColumns={defaultVisibleColumns}
          filterSearchValues={filterSearchValues}
          onFilterSearchChange={onFilterSearchChange}
          className={ucatCatalogToolbarClassName}
          rowClassName={ucatCatalogToolbarRowClassName}
          searchContainerClassName={ucatCatalogToolbarSearchContainerClassName}
          searchInputClassName={ucatCatalogToolbarSearchInputClassName}
          controlClassName={ucatCatalogToolbarControlClassName}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : !hasItems ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          <div className="space-y-1.5 pb-1 pt-px">{children}</div>
        )}
      </div>

      {!hidePagination && !isLoading ? (
        <div className="mt-2 shrink-0 px-1 pt-2">
          <TablePagination
            page={effectivePage}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
            pageSizeOptions={pageSizeOptions}
          />
        </div>
      ) : null}
    </div>
  )
}
