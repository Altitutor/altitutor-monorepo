'use client';

import { useCallback } from 'react';
import { useDataTable } from './useDataTable';
import { useAdminUrlSync } from './useAdminUrlSync';

export interface UseEntityListTableStateOptions {
  defaultFilters?: Record<string, unknown[]>;
  defaultSort?: { field: string; direction: 'asc' | 'desc' };
  defaultGroupBy?: string | null;
  filterKeys?: string[];
  skipUrlSync?: boolean;
}

/**
 * URL-synced toolbar state for EntityList / KanbanBoard list views.
 */
export function useEntityListTableState({
  defaultFilters = {},
  defaultSort = { field: 'name', direction: 'asc' as const },
  defaultGroupBy = null,
  filterKeys = [],
  skipUrlSync = false,
}: UseEntityListTableStateOptions = {}) {
  useAdminUrlSync();

  const {
    state,
    setSearch,
    setFilters,
    setSort,
    setGroupBy,
    applyQuickFilter,
    resetFilters,
  } = useDataTable({
    defaultFilters,
    defaultSort,
    defaultGroupBy,
    defaultVisibleColumns: [],
    filterKeys,
    skipUrlSync,
  });

  const handleSortChange = useCallback(
    (field: string, direction: 'asc' | 'desc') => {
      setSort(field, direction);
    },
    [setSort],
  );

  return {
    search: state.search,
    setSearch,
    filters: state.filters,
    setFilters,
    groupBy: state.groupBy ?? defaultGroupBy,
    setGroupBy,
    sortBy: state.sortBy ?? defaultSort.field,
    sortDirection: state.sortDirection,
    handleSortChange,
    applyQuickFilter,
    resetFilters,
  };
}
