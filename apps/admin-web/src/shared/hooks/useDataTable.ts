import { useState, useCallback, useEffect, useRef } from 'react';
import { usePaneNavigation } from './usePaneNavigation';
import { DataTableState, QuickFilter, resolveQuickFilterPlaceholders, getViewSettings, readViewSettings, isFilterMetadata } from '@altitutor/shared';

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

const MANAGED_PARAM_KEYS = ['search', 'sort', 'order', 'group', 'page', 'pageSize', 'columns', 'view'];

function mergeTableState(prev: DataTableState, updates: Partial<DataTableState>): DataTableState {
  const next: DataTableState = { ...prev, ...updates };

  if ('filters' in updates || 'search' in updates || 'sortBy' in updates || 'pageSize' in updates) {
    next.page = 'page' in updates && updates.page != null ? updates.page : 1;
  }

  return next;
}

function clearManagedParams(params: URLSearchParams, filterKeys?: string[]) {
  MANAGED_PARAM_KEYS.forEach((key) => params.delete(key));

  if (filterKeys) {
    Array.from(params.keys()).filter(key => filterKeys.includes(key) || isFilterMetadata(key)).forEach(key => params.delete(key));
    return;
  }

  Array.from(params.keys()).forEach((key) => {
    if (!MANAGED_PARAM_KEYS.includes(key)) {
      params.delete(key);
    }
  });
}

function applyTableStateToParams(
  params: URLSearchParams,
  tableState: DataTableState,
  initialPageSize: number,
  defaultVisibleColumns: string[],
  filterKeys?: string[],
  defaultGroupBy?: string | null,
) {
  clearManagedParams(params, filterKeys);

  if (tableState.view) params.set('view', tableState.view);

  if (tableState.search) {
    params.set('search', tableState.search);
  }

  params.set('sort', tableState.sortBy ?? '__none__');
  params.set('order', tableState.sortDirection);

  if (tableState.groupBy || defaultGroupBy) params.set('group', tableState.groupBy ?? '__none__');

  if (tableState.page > 1) {
    params.set('page', String(tableState.page));
  }

  if (tableState.pageSize !== initialPageSize) {
    params.set('pageSize', String(tableState.pageSize));
  }

  const columnsChanged =
    tableState.visibleColumns.join(',') !== defaultVisibleColumns.join(',');
  if (columnsChanged || tableState.columnsConfigured) {
    params.set('columns', tableState.visibleColumns.join(','));
  }

  const filterEntries = filterKeys
    ? Object.entries(tableState.filters).filter(([key]) => filterKeys.includes(key) || isFilterMetadata(key))
    : Object.entries(tableState.filters);

  filterEntries.forEach(([key, values]) => {
    if (values && values.length > 0) {
      params.set(key, values.some((value) => value !== null && typeof value === 'object') ? 'json:' + JSON.stringify(values) : values.map(String).join(','));
    }
  });
}

function buildTableHref(pathname: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

interface UseDataTableOptions {
  defaultFilters?: Record<string, unknown[]>;
  defaultSort?: { field: string; direction: 'asc' | 'desc' };
  defaultGroupBy?: string | null;
  defaultVisibleColumns?: string[];
  pageSize?: number;
  skipUrlSync?: boolean;
  filterKeys?: string[];
}

export function useDataTable({
  defaultFilters = {},
  defaultSort = { field: 'created_at', direction: 'desc' },
  defaultGroupBy = null,
  defaultVisibleColumns = [],
  pageSize: initialPageSize = 50,
  skipUrlSync = false,
  filterKeys,
}: UseDataTableOptions = {}) {
  const { router, searchParams, pathname } = usePaneNavigation();
  const isInitialLoad = useRef(true);
  const hasSyncedInitialDefaults = useRef(false);
  const pendingUrlUpdateRef = useRef(false);
  const isManagedKey = useCallback((key: string) => {
    if (key === 'view') return false;
    return MANAGED_PARAM_KEYS.includes(key) || (filterKeys ? (filterKeys.includes(key) || isFilterMetadata(key)) : !MANAGED_PARAM_KEYS.includes(key));
  }, [filterKeys]);

  const commitTableUrl = useCallback((tableState: DataTableState) => {
    const params = new URLSearchParams(searchParams.toString());
    applyTableStateToParams(params, tableState, initialPageSize, defaultVisibleColumns, filterKeys, defaultGroupBy);
    pendingUrlUpdateRef.current = true;
    router.replace(buildTableHref(pathname, params), { scroll: false });
  }, [defaultVisibleColumns, defaultGroupBy, filterKeys, initialPageSize, pathname, router, searchParams]);

  // Parse filters from URL helper
  const parseFiltersFromUrl = useCallback(() => {
    if (skipUrlSync) return {};
    const filters: Record<string, unknown[]> = {};
    searchParams.forEach((value, key) => {
      const canParseKey = filterKeys ? (filterKeys.includes(key) || isFilterMetadata(key)) : !MANAGED_PARAM_KEYS.includes(key);
      if (canParseKey) {
        if (value.startsWith('json:')) {try {const parsed: unknown = JSON.parse(value.slice(5)); if (Array.isArray(parsed)) filters[key] = parsed;} catch {} return;}
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
        view: searchParams.get('view') ?? undefined,
        columnsConfigured: false,
        filters: defaultFilters,
        sortBy: defaultSort.field,
        sortDirection: defaultSort.direction,
        groupBy: defaultGroupBy,
        page: 1,
        pageSize: initialPageSize,
        visibleColumns: defaultVisibleColumns,
        defaultVisibleColumns,
      };
    }

    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sort');
    const sortDirection = (searchParams.get('order') || defaultSort.direction) as 'asc' | 'desc';
    const groupBy = searchParams.get('group') === '__none__' ? null : searchParams.get('group') ?? defaultGroupBy;
    const page = Number(searchParams.get('page')) || 1;
    const pageSize = Number(searchParams.get('pageSize')) || initialPageSize;
    const visibleColumns = searchParams.get('columns')?.split(',').filter(Boolean) || defaultVisibleColumns;
    const filters = parseFiltersFromUrl();

    // Determine if we should use defaults or if we have an active state in the URL
    // We consider it "no state" if there are absolutely no managed params.
    // Use defaults whenever URL is empty (not just on first load) to avoid race where
    // router.replace hasn't updated searchParams yet, which would overwrite defaults with {}.
    const hasAnyParam = Array.from(searchParams.keys()).some((key) => isManagedKey(key));

    if (!hasAnyParam) {
      return {
        search: '',
        view: searchParams.get('view') ?? undefined,
        columnsConfigured: false,
        filters: defaultFilters,
        sortBy: defaultSort.field,
        sortDirection: defaultSort.direction,
        groupBy: defaultGroupBy,
        page: 1,
        pageSize: initialPageSize,
        visibleColumns: defaultVisibleColumns,
        defaultVisibleColumns,
      };
    }

    return {
      search,
      view: searchParams.get('view') ?? undefined,
      columnsConfigured: searchParams.has('columns'),
      filters,
      sortBy: sortBy === '__none__' ? null : sortBy || defaultSort.field,
      sortDirection,
      groupBy,
      page,
      pageSize,
      visibleColumns,
      defaultVisibleColumns,
    };
  }, [searchParams, defaultFilters, defaultSort, defaultGroupBy, initialPageSize, defaultVisibleColumns, parseFiltersFromUrl, skipUrlSync, isManagedKey]);

  const [state, setState] = useState<DataTableState>(getInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Sync state with URL changes
  useEffect(() => {
    if (skipUrlSync) return;

    const derivedState = getInitialState();
    // Don't overwrite optimistic state with stale URL while our router.replace is in flight
    if (pendingUrlUpdateRef.current) {
      if (isEqual(derivedState, state)) {
        pendingUrlUpdateRef.current = false;
      }
      if (isInitialLoad.current) isInitialLoad.current = false;
      return;
    }
    if (!isEqual(derivedState, state)) {
      setState(derivedState);
    }
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

    hasSyncedInitialDefaults.current = true;
    commitTableUrl(getInitialState());
  }, [commitTableUrl, getInitialState, isManagedKey, searchParams, skipUrlSync]);

  // Update state helper
  const updateState = useCallback((updates: Partial<DataTableState>) => {
    setState(prev => {
      const next = mergeTableState(prev, updates);
      return isEqual(prev, next) ? prev : next;
    });
  }, []);

  // Update URL helper - serialize the full next table state so params never go missing
  const updateUrl = useCallback((updates: Partial<DataTableState>) => {
    const next = mergeTableState(stateRef.current, updates);
    if (isEqual(stateRef.current, next)) return;

    stateRef.current = next;
    setState(next);
    if (!skipUrlSync) {
      commitTableUrl(next);
    }
  }, [commitTableUrl, skipUrlSync]);

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
    updateUrl({ visibleColumns: columns, columnsConfigured: true });
  }, [updateUrl]);

  const applyQuickFilter = useCallback((qf: QuickFilter, currentUserId?: string | null) => {
    const display = getViewSettings(qf.config);
    if (display) {
      updateUrl({filters: resolveQuickFilterPlaceholders(display.filters,currentUserId ?? undefined),sortBy:display.sortBy,sortDirection:display.sortDirection,groupBy:display.groupBy,visibleColumns:display.visibleColumns,columnsConfigured:true,...(display.layout ? {view:display.layout} : {}),page:1});
      return;
    }
    const normalizedConfig = readViewSettings(qf.config, {filters:{},sortBy:null,sortDirection:'asc',groupBy:null,visibleColumns:[]},currentUserId ?? undefined).filters;
    setFilters(normalizedConfig);
  }, [setFilters, updateUrl]);

  const resetFilters = useCallback(() => {
    const resetState: DataTableState = {
      search: '',
      view: stateRef.current.view,
      columnsConfigured: false,
      filters: defaultFilters,
      sortBy: defaultSort.field,
      sortDirection: defaultSort.direction,
      groupBy: defaultGroupBy,
      page: 1,
      pageSize: initialPageSize,
      visibleColumns: defaultVisibleColumns,
      defaultVisibleColumns,
    };

    if (skipUrlSync) {
      updateState(resetState);
      return;
    }

    setState(resetState);
    commitTableUrl(resetState);
  }, [commitTableUrl, defaultFilters, defaultGroupBy, defaultSort.direction, defaultSort.field, defaultVisibleColumns, initialPageSize, skipUrlSync, updateState]);

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
