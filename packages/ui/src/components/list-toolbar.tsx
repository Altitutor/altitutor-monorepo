'use client';

import * as React from 'react';
import type { DataTableFilterDefinition, DataTableSortOption, DataTableState } from '@altitutor/shared';
import { DataTableToolbar } from './data-table-toolbar';

export interface ListToolbarProps {
  /** Controlled search value */
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Optional filters: when provided, the Filter dropdown is shown */
  filterDefinitions?: DataTableFilterDefinition[];
  filters?: Record<string, unknown[]>;
  onFiltersChange?: (filters: Record<string, unknown[]>) => void;
  /** Optional sort: when provided, the Sort dropdown is shown */
  sortOptions?: DataTableSortOption[];
  sortBy?: string | null;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (field: string | null, direction: 'asc' | 'desc') => void;
}

const emptyState: DataTableState = {
  search: '',
  filters: {},
  sortBy: null,
  sortDirection: 'desc',
  groupBy: null,
  page: 1,
  pageSize: 20,
  visibleColumns: [],
};

/**
 * Toolbar for list views (search, optional filter, and optional sort).
 * Uses the same visual style as DataTableToolbar.
 */
export function ListToolbar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filterDefinitions = [],
  filters = {},
  onFiltersChange = () => {},
  sortOptions = [],
  sortBy = null,
  sortDirection = 'desc',
  onSortChange,
}: ListToolbarProps) {
  const state: DataTableState = React.useMemo(
    () => ({
      ...emptyState,
      search,
      filters,
      sortBy: sortOptions.length > 0 ? sortBy : null,
      sortDirection,
    }),
    [search, filters, sortOptions.length, sortBy, sortDirection]
  );

  const handleSortChange = React.useCallback(
    (field: string | null, direction: 'asc' | 'desc') => {
      onSortChange?.(field, direction);
    },
    [onSortChange]
  );

  const handleReset = React.useCallback(() => {
    onSearchChange('');
    onFiltersChange({});
    if (onSortChange) onSortChange(null, 'desc');
  }, [onSearchChange, onFiltersChange, onSortChange]);

  return (
    <DataTableToolbar
      state={state}
      onSearchChange={onSearchChange}
      onFiltersChange={onFiltersChange}
      onSortChange={sortOptions.length > 0 ? handleSortChange : () => {}}
      onGroupByChange={() => {}}
      onVisibleColumnsChange={() => {}}
      onQuickFilterApply={() => {}}
      onReset={handleReset}
      filterDefinitions={filterDefinitions}
      sortOptions={sortOptions}
      columnDefinitions={[]}
      groupByOptions={[]}
      searchPlaceholder={searchPlaceholder}
    />
  );
}
