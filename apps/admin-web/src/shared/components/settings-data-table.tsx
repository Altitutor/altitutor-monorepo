'use client';

import { useMemo, type ReactNode } from 'react';
import {
  DataTableToolbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
} from '@altitutor/ui';
import type {
  DataTableColumnDefinition,
  DataTableFilterDefinition,
  DataTableGroupByOption,
  DataTableSortOption,
  DataTableState,
} from '@altitutor/shared';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { SettingsTableActions, type SettingsTableAction } from './settings-table-actions';

export type SettingsDataTableColumn<T> = {
  key: string;
  label: string;
  className?: string;
  visibleByDefault?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  groupable?: boolean;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | boolean | Date | null | undefined;
  filterValue?: (row: T) => unknown;
  searchValue?: (row: T) => string;
};

export function SettingsDataTable<T>({
  data,
  columns,
  getRowId,
  getActions,
  emptyMessage = 'No results.',
  searchPlaceholder = 'Search...',
  filterDefinitions = [],
  sortOptions,
  groupByOptions = [],
  pageSize = 20,
  filterKeys,
  defaultSort,
  isLoading,
}: {
  data: T[];
  columns: SettingsDataTableColumn<T>[];
  getRowId: (row: T) => string;
  getActions?: (row: T) => SettingsTableAction[];
  emptyMessage?: string;
  searchPlaceholder?: string;
  filterDefinitions?: DataTableFilterDefinition[];
  sortOptions?: DataTableSortOption[];
  groupByOptions?: DataTableGroupByOption[];
  pageSize?: number;
  filterKeys?: string[];
  defaultSort?: { field: string; direction: 'asc' | 'desc' };
  isLoading?: boolean;
}) {
  const defaultVisibleColumns = useMemo(
    () => columns.filter((column) => column.visibleByDefault !== false).map((column) => column.key),
    [columns],
  );

  const {
    state,
    setSearch,
    setFilters,
    setSort,
    setGroupBy,
    setVisibleColumns,
    setPage,
    setPageSize,
    resetFilters,
  } = useDataTable({
    defaultVisibleColumns,
    defaultSort: defaultSort ?? { field: columns[0]?.key ?? 'name', direction: 'asc' },
    pageSize,
    filterKeys,
  });

  const columnDefinitions: DataTableColumnDefinition[] = useMemo(
    () =>
      columns.map((column) => ({
        key: column.key,
        label: column.label,
        visibleByDefault: column.visibleByDefault !== false,
        sortable: column.sortable !== false,
        filterable: column.filterable,
        groupable: column.groupable,
      })),
    [columns],
  );

  const resolvedSortOptions = useMemo(
    () =>
      sortOptions ??
      columns
        .filter((column) => column.sortable !== false)
        .map((column) => ({ key: column.key, label: column.label })),
    [columns, sortOptions],
  );

  const visibleColumns = useMemo(
    () => columns.filter((column) => state.visibleColumns.includes(column.key)),
    [columns, state.visibleColumns],
  );

  const processedData = useMemo(() => {
    const search = state.search.trim().toLowerCase();
    let rows = [...data];

    if (search) {
      rows = rows.filter((row) =>
        columns.some((column) => {
          const value = column.searchValue?.(row) ?? String(column.sortValue?.(row) ?? column.filterValue?.(row) ?? '');
          return value.toLowerCase().includes(search);
        }),
      );
    }

    for (const [key, values] of Object.entries(state.filters)) {
      if (!values.length) continue;
      const column = columns.find((item) => item.key === key);
      if (!column) continue;
      rows = rows.filter((row) => {
        const rowValue = column.filterValue?.(row) ?? column.sortValue?.(row);
        return values.some((value) => String(value) === String(rowValue));
      });
    }

    if (state.sortBy) {
      const column = columns.find((item) => item.key === state.sortBy);
      if (column) {
        rows.sort((a, b) => compareValues(column.sortValue?.(a), column.sortValue?.(b), state.sortDirection));
      }
    }

    return rows;
  }, [columns, data, state.filters, state.search, state.sortBy, state.sortDirection]);

  const pageCount = Math.max(1, Math.ceil(processedData.length / state.pageSize));
  const page = Math.min(Math.max(state.page, 1), pageCount);
  const pagedData = processedData.slice((page - 1) * state.pageSize, page * state.pageSize);

  return (
    <div className="space-y-4">
      <DataTableToolbar
        state={state}
        onSearchChange={setSearch}
        onFiltersChange={setFilters}
        onSortChange={setSort}
        onGroupByChange={setGroupBy}
        onVisibleColumnsChange={setVisibleColumns}
        onQuickFilterApply={() => undefined}
        onReset={resetFilters}
        filterDefinitions={filterDefinitions}
        sortOptions={resolvedSortOptions}
        groupByOptions={groupByOptions}
        columnDefinitions={columnDefinitions}
        defaultVisibleColumns={defaultVisibleColumns}
        searchPlaceholder={searchPlaceholder}
        isLoading={isLoading}
      />

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((column) => (
                <TableHead key={column.key} className={column.className}>
                  {column.label}
                </TableHead>
              ))}
              {getActions ? <TableHead className="w-[56px]" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visibleColumns.length + (getActions ? 1 : 0)}
                  className="h-24 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              pagedData.map((row) => (
                <TableRow key={getRowId(row)}>
                  {visibleColumns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.render(row)}
                    </TableCell>
                  ))}
                  {getActions ? (
                    <TableCell className="text-right">
                      <SettingsTableActions actions={getActions(row)} className="flex justify-end" />
                    </TableCell>
                  ) : null}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={page}
        pageSize={state.pageSize}
        total={processedData.length}
        isFetching={isLoading}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}

function compareValues(
  a: string | number | boolean | Date | null | undefined,
  b: string | number | boolean | Date | null | undefined,
  direction: DataTableState['sortDirection'],
) {
  const normalizedA = normalizeSortValue(a);
  const normalizedB = normalizeSortValue(b);
  if (normalizedA < normalizedB) return direction === 'asc' ? -1 : 1;
  if (normalizedA > normalizedB) return direction === 'asc' ? 1 : -1;
  return 0;
}

function normalizeSortValue(value: string | number | boolean | Date | null | undefined): string | number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value;
  return String(value ?? '').toLowerCase();
}
