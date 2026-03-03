import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { DataTableState, QuickFilter, resolveQuickFilterPlaceholders } from '@altitutor/shared';
import { addDays, endOfWeek, format, startOfWeek, subDays } from 'date-fns';

// Helper for deep equality check that handles key ordering
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  
  const keysA = Object.keys(a as object).sort();
  const keysB = Object.keys(b as object).sort();
  
  if (keysA.length !== keysB.length) return false;
  
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i];
    if (keysA[i] !== keysB[i] || !isEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  
  return true;
}

interface UseDataTableOptions {
  defaultFilters?: Record<string, unknown[]>;
  defaultSort?: { field: string; direction: 'asc' | 'desc' };
  defaultVisibleColumns?: string[];
  pageSize?: number;
  skipUrlSync?: boolean;
  filterKeys?: string[];
}

export function useDataTable({
  defaultFilters = {},
  defaultSort = { field: 'created_at', direction: 'desc' },
  defaultVisibleColumns = [],
  pageSize: initialPageSize = 50,
  skipUrlSync = false,
  filterKeys,
}: UseDataTableOptions = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isInitialLoad = useRef(true);
  const hasSyncedInitialDefaults = useRef(false);
  const managedParamKeys = ['search', 'sort', 'order', 'group', 'page', 'pageSize', 'columns'];
  const isManagedKey = useCallback((key: string) => {
    return managedParamKeys.includes(key) || (filterKeys ? filterKeys.includes(key) : !managedParamKeys.includes(key));
  }, [filterKeys]);

  // Parse filters from URL helper
  const parseFiltersFromUrl = useCallback(() => {
    if (skipUrlSync) return {};
    const filters: Record<string, unknown[]> = {};
    searchParams.forEach((value, key) => {
      const canParseKey = filterKeys ? filterKeys.includes(key) : !managedParamKeys.includes(key);
      if (canParseKey) {
        const values = value.split(',').filter(Boolean);
        filters[key] = values.map(v => {
          const num = Number(v);
          return isNaN(num) ? v : num;
        });
      }
    });
    return filters;
  }, [searchParams, skipUrlSync, filterKeys]);

  // Helper to get initial state from URL or defaults
  const getInitialState = useCallback((): DataTableState => {
    if (skipUrlSync) {
      return {
        search: '',
        filters: defaultFilters,
        sortBy: defaultSort.field,
        sortDirection: defaultSort.direction,
        groupBy: null,
        page: 1,
        pageSize: initialPageSize,
        visibleColumns: defaultVisibleColumns,
      };
    }

    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort');
    const sortDirection = (searchParams.get('order') || defaultSort.direction) as 'asc' | 'desc';
    const groupBy = searchParams.get('group');
    const page = Number(searchParams.get('page')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || initialPageSize;
    const visibleColumns = searchParams.get('columns')?.split(',').filter(Boolean) || defaultVisibleColumns;
    const filters = parseFiltersFromUrl();

    // Determine if we should use defaults or if we have an active state in the URL
    // We consider it "no state" if there are absolutely no managed params
    const hasAnyParam = Array.from(searchParams.keys()).some((key) => isManagedKey(key));
    
    if (isInitialLoad.current && !hasAnyParam) {
      return {
        search: '',
        filters: defaultFilters,
        sortBy: defaultSort.field,
        sortDirection: defaultSort.direction,
        groupBy: null,
        page: 1,
        pageSize: initialPageSize,
        visibleColumns: defaultVisibleColumns,
      };
    }

    return {
      search,
      filters,
      sortBy: sortBy || (isInitialLoad.current ? defaultSort.field : null),
      sortDirection,
      groupBy,
      page,
      pageSize,
      visibleColumns,
    };
  }, [searchParams, defaultFilters, defaultSort, initialPageSize, defaultVisibleColumns, parseFiltersFromUrl, skipUrlSync, isManagedKey]);

  const [state, setState] = useState<DataTableState>(getInitialState);

  // Sync state with URL changes
  useEffect(() => {
    if (skipUrlSync) return;
    
    const derivedState = getInitialState();
    if (!isEqual(derivedState, state)) {
      setState(derivedState);
    }
    // Mark initial load as complete after first sync
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
    }
  }, [getInitialState, state, skipUrlSync]);

  // Keep defaults visible/removable by writing them to URL once on first load.
  useEffect(() => {
    if (skipUrlSync || hasSyncedInitialDefaults.current) return;
    const hasManagedState = Array.from(searchParams.keys()).some((key) => isManagedKey(key));
    if (hasManagedState) {
      hasSyncedInitialDefaults.current = true;
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', defaultSort.field);
    params.set('order', defaultSort.direction);
    Object.entries(defaultFilters).forEach(([key, values]) => {
      if (values && values.length > 0) {
        params.set(key, values.join(','));
      }
    });

    hasSyncedInitialDefaults.current = true;
    router.replace(`${pathname}?${params.toString()}`);
  }, [defaultFilters, defaultSort.direction, defaultSort.field, isManagedKey, pathname, router, searchParams, skipUrlSync]);

  // Update state helper
  const updateState = useCallback((updates: Partial<DataTableState>) => {
    setState(prev => {
      const next = { ...prev, ...updates };
      
      // Handle dependent updates
      if ('filters' in updates || 'search' in updates || 'sortBy' in updates || 'pageSize' in updates) {
        next.page = 1;
      }
      
      return isEqual(prev, next) ? prev : next;
    });
  }, []);

  // Update URL helper - stable and minimal dependencies
  const updateUrl = useCallback((updates: Partial<DataTableState>) => {
    if (skipUrlSync) {
      updateState(updates);
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    
    if ('search' in updates) {
      if (updates.search) params.set('search', updates.search);
      else params.delete('search');
    }
    
    if ('sortBy' in updates) {
      if (updates.sortBy) {
        params.set('sort', updates.sortBy);
        params.set('order', updates.sortDirection || 'desc');
      } else {
        params.delete('sort');
        params.delete('order');
      }
    } else if ('sortDirection' in updates && state.sortBy) {
      params.set('order', updates.sortDirection || 'desc');
    }

    if ('groupBy' in updates) {
      if (updates.groupBy) params.set('group', updates.groupBy);
      else params.delete('group');
    }

    if ('page' in updates) {
      if (updates.page && updates.page > 1) params.set('page', String(updates.page));
      else params.delete('page');
    }

    if ('pageSize' in updates) {
      if (updates.pageSize && updates.pageSize !== initialPageSize) params.set('pageSize', String(updates.pageSize));
      else params.delete('pageSize');
    }

    if ('visibleColumns' in updates) {
      if (updates.visibleColumns && updates.visibleColumns.length > 0) params.set('columns', updates.visibleColumns.join(','));
      else params.delete('columns');
    }

    if ('filters' in updates && updates.filters) {
      const currentKeys = Array.from(params.keys());
      const keysToClear = filterKeys
        ? currentKeys.filter((key) => filterKeys.includes(key))
        : currentKeys.filter((key) => !managedParamKeys.includes(key));
      keysToClear.forEach((key) => params.delete(key));
      
      if (filterKeys) {
        filterKeys.forEach((key) => {
          const values = updates.filters?.[key];
          if (values && values.length > 0) {
            params.set(key, values.join(','));
          }
        });
      } else {
        Object.entries(updates.filters).forEach(([key, values]) => {
          if (values && values.length > 0) {
            params.set(key, values.join(','));
          }
        });
      }
    }

    router.push(`${pathname}?${params.toString()}`);
  }, [filterKeys, router, pathname, searchParams, initialPageSize, state.sortBy, skipUrlSync, updateState]);

  const setSearch = useCallback((search: string) => {
    updateUrl({ search, page: 1 });
  }, [updateUrl]);

  const setSort = useCallback((field: string | null, direction: 'asc' | 'desc') => {
    updateUrl({ sortBy: field, sortDirection: direction, page: 1 });
  }, [updateUrl]);

  const setGroupBy = useCallback((field: string | null) => {
    updateUrl({ groupBy: field, page: 1 });
  }, [updateUrl]);

  const setFilters = useCallback((filters: Record<string, unknown[]>) => {
    updateUrl({ filters, page: 1 });
  }, [updateUrl]);

  const toggleFilter = useCallback((key: string, value: unknown) => {
    const current = state.filters[key] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    
    const newFilters = { ...state.filters, [key]: next.filter((v) => v != null) };
    if (next.length === 0) {
      delete newFilters[key];
    }
    
    setFilters(newFilters);
  }, [state.filters, setFilters]);

  const setPage = useCallback((page: number) => {
    updateUrl({ page });
  }, [updateUrl]);

  const setPageSize = useCallback((pageSize: number) => {
    updateUrl({ pageSize, page: 1 });
  }, [updateUrl]);

  const setVisibleColumns = useCallback((columns: string[]) => {
    updateUrl({ visibleColumns: columns });
  }, [updateUrl]);

  const applyQuickFilter = useCallback((qf: QuickFilter, currentUserId?: string | null) => {
    const resolvedConfig = resolveQuickFilterPlaceholders(qf.config, currentUserId || undefined);
    const normalizedConfig = { ...resolvedConfig } as Record<string, unknown[]>;
    const legacyDateKeys = ['scheduled_at', 'date', 'created_at', 'start_time'];
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const yesterday = format(subDays(now, 1), 'yyyy-MM-dd');
    const tomorrow = format(addDays(now, 1), 'yyyy-MM-dd');
    const monday = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const sunday = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');

    legacyDateKeys.forEach((legacyKey) => {
      const legacyValues = normalizedConfig[legacyKey];
      if (!legacyValues || legacyValues.length === 0) return;

      const first = String(legacyValues[0]);
      if (first === '$THIS_WEEK$') {
        normalizedConfig.from = [monday];
        normalizedConfig.to = [sunday];
      } else if (first === '$TODAY$') {
        normalizedConfig.from = [today];
        normalizedConfig.to = [today];
      } else if (first === '$YESTERDAY$') {
        normalizedConfig.from = [yesterday];
        normalizedConfig.to = [yesterday];
      } else if (first === '$TOMORROW$') {
        normalizedConfig.from = [tomorrow];
        normalizedConfig.to = [tomorrow];
      } else if (first === '$FUTURE$') {
        normalizedConfig.from = [today];
      } else if (first === '$PAST$') {
        normalizedConfig.to = [today];
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(first)) {
        normalizedConfig.from = [first];
        normalizedConfig.to = [first];
      }

      delete normalizedConfig[legacyKey];
    });

    setFilters(normalizedConfig);
  }, [setFilters]);

  const resetFilters = useCallback(() => {
    // Clear everything explicitly in the URL
    const params = new URLSearchParams();
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname]);

  return {
    state,
    setSearch,
    setSort,
    setGroupBy,
    setFilters,
    toggleFilter,
    setPage,
    setPageSize,
    setVisibleColumns,
    applyQuickFilter,
    resetFilters,
  };
}
