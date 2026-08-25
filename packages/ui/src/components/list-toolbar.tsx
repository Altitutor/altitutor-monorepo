'use client';

import * as React from 'react';
import type {
  DataTableFilterDefinition,
  DataTableSortOption,
  DataTableGroupByOption,
  DataTableColumnDefinition,
  DataTableState,
} from '@altitutor/shared';
import { DataTableToolbar, type DataTableColumnViewGroup, type DataTableSearchFromOption } from './data-table-toolbar';

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
  /** Optional group by: when provided, the Group by dropdown is shown */
  groupByOptions?: DataTableGroupByOption[];
  groupBy?: string | null;
  onGroupByChange?: (field: string | null) => void;
  /** Optional columns: when provided, the View dropdown is shown */
  columnDefinitions?: DataTableColumnDefinition[];
  visibleColumns?: string[];
  onVisibleColumnsChange?: (columns: string[]) => void;
  columnViewGroups?: DataTableColumnViewGroup[];
  /** Default visible columns for the View reset pill */
  defaultVisibleColumns?: string[];
  filterSearchValues?: Record<string, string>;
  onFilterSearchChange?: (filterKey: string, value: string) => void;
  /** Icon-only controls for narrow panels (e.g. editor sidebars). */
  compact?: boolean;
  className?: string;
  rowClassName?: string;
  searchFromOptions?: DataTableSearchFromOption[];
  searchFromValue?: string[];
  onSearchFromChange?: (values: string[]) => void;
  searchContainerClassName?: string;
  searchInputClassName?: string;
  controlClassName?: string;
  searchLeadingAccessory?: React.ReactNode;
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
  defaultVisibleColumns: undefined,
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
  groupByOptions = [],
  groupBy = null,
  onGroupByChange,
  columnDefinitions = [],
  visibleColumns = [],
  onVisibleColumnsChange,
  columnViewGroups = [],
  defaultVisibleColumns,
  filterSearchValues,
  onFilterSearchChange,
  compact = false,
  className,
  rowClassName,
  searchFromOptions,
  searchFromValue,
  onSearchFromChange,
  searchContainerClassName,
  searchInputClassName,
  controlClassName,
  searchLeadingAccessory,
}: ListToolbarProps) {
  const state: DataTableState = React.useMemo(
    () => ({
      ...emptyState,
      search,
      filters,
      sortBy: sortOptions.length > 0 ? sortBy : null,
      sortDirection,
      groupBy: groupByOptions.length > 0 ? groupBy : null,
      visibleColumns: columnDefinitions.length > 0 ? visibleColumns : [],
      defaultVisibleColumns: columnDefinitions.length > 0 ? defaultVisibleColumns : undefined,
    }),
    [search, filters, sortOptions.length, sortBy, sortDirection, groupByOptions.length, groupBy, columnDefinitions.length, visibleColumns, defaultVisibleColumns]
  );

  const handleSortChange = React.useCallback(
    (field: string | null, direction: 'asc' | 'desc') => {
      onSortChange?.(field, direction);
    },
    [onSortChange]
  );

  const handleGroupByChange = React.useCallback(
    (field: string | null) => {
      onGroupByChange?.(field);
    },
    [onGroupByChange]
  );

  const handleVisibleColumnsChange = React.useCallback(
    (columns: string[]) => {
      onVisibleColumnsChange?.(columns);
    },
    [onVisibleColumnsChange]
  );

  const handleReset = React.useCallback(() => {
    onSearchChange('');
    onFiltersChange({});
    if (onSortChange) onSortChange(null, 'desc');
    if (onGroupByChange) onGroupByChange(null);
  }, [onSearchChange, onFiltersChange, onSortChange, onGroupByChange]);

  return (
    <DataTableToolbar
      state={state}
      onSearchChange={onSearchChange}
      onFiltersChange={onFiltersChange}
      onSortChange={sortOptions.length > 0 ? handleSortChange : () => {}}
      onGroupByChange={groupByOptions.length > 0 ? handleGroupByChange : () => {}}
      onVisibleColumnsChange={columnDefinitions.length > 0 ? handleVisibleColumnsChange : () => {}}
      onQuickFilterApply={() => {}}
      onReset={handleReset}
      filterDefinitions={filterDefinitions}
      sortOptions={sortOptions}
      columnDefinitions={columnDefinitions}
      defaultVisibleColumns={defaultVisibleColumns}
      columnViewGroups={columnViewGroups}
      groupByOptions={groupByOptions}
      searchPlaceholder={searchPlaceholder}
      searchFromOptions={searchFromOptions}
      searchFromValue={searchFromValue}
      onSearchFromChange={onSearchFromChange}
      filterSearchValues={filterSearchValues}
      onFilterSearchChange={onFilterSearchChange}
      compact={compact}
      className={className}
      rowClassName={rowClassName}
      searchContainerClassName={searchContainerClassName}
      searchInputClassName={searchInputClassName}
      controlClassName={controlClassName}
      searchLeadingAccessory={searchLeadingAccessory}
    />
  );
}
