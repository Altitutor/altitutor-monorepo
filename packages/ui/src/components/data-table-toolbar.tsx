'use client';

import * as React from 'react';
import {
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  Search,
  Layers,
} from 'lucide-react';
import type {
  DataTableState,
  QuickFilter,
  DataTableFilterDefinition,
  DataTableFilterOption,
  DataTableSortOption,
  DataTableGroupByOption,
  DataTableColumnDefinition,
} from '@altitutor/shared';
import { useDebounce } from '@altitutor/shared/hooks';
import { Button } from './button';
import { Input } from './input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { ScrollArea } from './scroll-area';
import { SearchableSelectInline } from './searchable-select-inline';
import { DateRangeFilter } from './date-range-filter';
import { ToolbarActiveBadge } from './toolbar-active-badge';
import { cn } from '../lib/cn';
import { useRemountPersistentState } from '../hooks/use-remount-persistent-state';
import {
  canResolveDefaultVisibleColumns,
  countColumnViewLayoutDiff,
  countVisibleColumnLayoutDiff,
  ensureAtLeastOneVisibleColumn,
  resolveDefaultVisibleColumns,
} from '../lib/column-view-layout';

interface DataTableToolbarProps {
  state: DataTableState;
  onSearchChange: (value: string) => void;
  onFiltersChange: (filters: Record<string, unknown[]>) => void;
  onSortChange: (field: string | null, direction: 'asc' | 'desc') => void;
  onGroupByChange: (field: string | null) => void;
  onVisibleColumnsChange: (columns: string[]) => void;
  onQuickFilterApply: (qf: QuickFilter) => void;
  onReset: () => void;
  
  filterDefinitions?: DataTableFilterDefinition[];
  sortOptions?: DataTableSortOption[];
  groupByOptions?: DataTableGroupByOption[];
  columnDefinitions?: DataTableColumnDefinition[];
  /** Default visible columns; when omitted, derived from columnDefinitions.visibleByDefault when set */
  defaultVisibleColumns?: string[];
  quickFilters?: QuickFilter[];
  
  className?: string;
  rowClassName?: string;
  searchPlaceholder?: string;
  searchFromOptions?: DataTableSearchFromOption[];
  searchFromValue?: string[];
  onSearchFromChange?: (values: string[]) => void;
  searchContainerClassName?: string;
  searchInputClassName?: string;
  controlClassName?: string;
  isLoading?: boolean;
  filterSearchValues?: Record<string, string>;
  onFilterSearchChange?: (filterKey: string, value: string) => void;
  /** Optional content rendered at the bottom of the Filters dropdown (e.g. "Show deleted" toggle) */
  filterFooter?: React.ReactNode;
  /** When true, "Show deleted" is considered an active filter: button shows count and X clears it */
  showDeletedActive?: boolean;
  /** Called when the user clears the "Show deleted" filter (e.g. via the X button) */
  onClearShowDeleted?: () => void;
  /** Custom filter content for specific keys - renders inside DropdownMenuSub (e.g. SearchableSelectInline) */
  customFilterContent?: Record<string, React.ReactNode>;
  /** When true, the search input is hidden (filters / view / sort remain) */
  hideSearch?: boolean;
  /** Optional content rendered inside the leading edge of the search field. Replaces the default search icon. */
  searchLeadingAccessory?: React.ReactNode;
  /** Optional content rendered beside the search input. */
  searchAccessory?: React.ReactNode;
  /** Icon-only controls for narrow panels (e.g. editor sidebars). */
  compact?: boolean;
  /** When true, search-from toggles appear in the View dropdown instead of beside the search field */
  searchFromInView?: boolean;
  /** Search-from options shown under the Question stems heading (after columns) */
  stemSearchFromOptions?: DataTableSearchFromOption[];
  /** Additional grouped search-from options for the View dropdown (used with searchFromInView) */
  searchFromViewGroups?: Array<{ heading: string; options: DataTableSearchFromOption[] }>;
  /** Grouped column visibility sections (e.g. stem / question / answer option columns) */
  columnViewGroups?: DataTableColumnViewGroup[];
}

export interface DataTableColumnViewGroup {
  heading: string;
  columnDefinitions: DataTableColumnDefinition[];
  visibleColumns: string[];
  onVisibleColumnsChange: (columns: string[]) => void;
  /** Default visible columns for this group; when omitted, derived from columnDefinitions.visibleByDefault when set */
  defaultVisibleColumns?: string[];
}

export interface DataTableSearchFromOption {
  label: string;
  value: string;
}

export function DataTableToolbar({
  state,
  onSearchChange,
  onFiltersChange,
  onSortChange,
  onGroupByChange,
  onVisibleColumnsChange,
  onQuickFilterApply,
  onReset: _onReset,
  filterDefinitions = [],
  sortOptions = [],
  groupByOptions = [],
  columnDefinitions = [],
  defaultVisibleColumns,
  quickFilters = [],
  className,
  rowClassName,
  searchPlaceholder = 'Search...',
  searchFromOptions = [],
  searchFromValue,
  onSearchFromChange,
  searchContainerClassName,
  searchInputClassName,
  controlClassName,
  isLoading: _isLoading = false,
  filterSearchValues: _filterSearchValues = {},
  onFilterSearchChange,
  filterFooter,
  showDeletedActive = false,
  onClearShowDeleted,
  customFilterContent = {},
  hideSearch = false,
  searchLeadingAccessory,
  searchAccessory,
  compact = false,
  searchFromInView = false,
  stemSearchFromOptions = [],
  searchFromViewGroups,
  columnViewGroups = [],
}: DataTableToolbarProps) {
  const [searchValue, setSearchValue] = React.useState(state.search);
  const debouncedSearch = useDebounce(searchValue, 300);
  const prevStateSearchRef = React.useRef(state.search);
  const isInternalUpdateRef = React.useRef(false);
  const onSearchChangeRef = React.useRef(onSearchChange);
  onSearchChangeRef.current = onSearchChange;
  const [groupByOpen, setGroupByOpen] = React.useState(false);
  const [sortOpen, setSortOpen] = React.useState(false);
  const filterPersistenceKey = `data-table-toolbar:filters:${typeof window === 'undefined' ? '' : window.location.pathname}`;
  const [filterOpen, setFilterOpen] = useRemountPersistentState(filterPersistenceKey, false);

  // Sync internal search state with prop state (e.g. if cleared from outside)
  // Only sync when state.search changes externally, not during local typing
  React.useEffect(() => {
    // Skip sync if this update came from our own debounced callback
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      prevStateSearchRef.current = state.search;
      return;
    }

    // Only update if state.search changed from an external source
    if (state.search !== prevStateSearchRef.current) {
      setSearchValue(state.search);
      prevStateSearchRef.current = state.search;
    }
  }, [state.search]);

  // Push debounced local search to parent. Keep the callback in a ref so URL-driven
  // parent identity churn (common on tab switches) cannot re-fire this effect and
  // fight an external reset into an update-depth loop.
  React.useEffect(() => {
    if (debouncedSearch === state.search) return;
    isInternalUpdateRef.current = true;
    onSearchChangeRef.current(debouncedSearch);
  }, [debouncedSearch, state.search]);

  const rangeFilterDefs = filterDefinitions.filter((d) => d.type === 'number-range' && d.minKey && d.maxKey);
  const dateRangeFilterDefs = filterDefinitions.filter(
    (d) => d.type === 'date-range' && d.fromKey && d.toKey
  );
  const activeFilterCount: number = (() => {
    let count = 0;
    for (const [key, arr] of Object.entries(state.filters)) {
      const def = filterDefinitions.find(
        (d) =>
          d.key === key ||
          d.minKey === key ||
          d.maxKey === key ||
          d.fromKey === key ||
          d.toKey === key
      );
      if (def?.type === 'number-range') continue;
      if (def?.type === 'date-range') continue;
      count += Array.isArray(arr) ? arr.length : 0;
    }
    for (const def of rangeFilterDefs) {
      const minArr = def.minKey ? state.filters[def.minKey] : [];
      const maxArr = def.maxKey ? state.filters[def.maxKey] : [];
      const minSet = Array.isArray(minArr) && minArr.length > 0 && minArr[0] != null && minArr[0] !== '';
      const maxSet = Array.isArray(maxArr) && maxArr.length > 0 && maxArr[0] != null && maxArr[0] !== '';
      const nullSet =
        !!def.nullOptionLabel &&
        (state.filters[def.key] ?? []).some((v) => String(v) === '__null__');
      if (minSet || maxSet || nullSet) count += 1;
    }
    for (const def of dateRangeFilterDefs) {
      const fromArr = def.fromKey ? state.filters[def.fromKey] : [];
      const toArr = def.toKey ? state.filters[def.toKey] : [];
      const fromSet =
        Array.isArray(fromArr) && fromArr.length > 0 && fromArr[0] != null && String(fromArr[0]).trim() !== '';
      const toSet =
        Array.isArray(toArr) && toArr.length > 0 && toArr[0] != null && String(toArr[0]).trim() !== '';
      if (fromSet || toSet) count += 1;
    }
    return count;
  })();

  const removeFilterValue = (columnKey: string, value: unknown) => {
    const current = state.filters[columnKey] ?? [];
    const next = current.filter((v: unknown) => v !== value);
    const nextFilters = { ...state.filters, [columnKey]: next };
    if (next.length === 0) {
      delete nextFilters[columnKey];
    }
    onFiltersChange(nextFilters);
  };

  const setSingleFilterValue = (columnKey: string, value: string) => {
    const trimmed = value.trim();
    const nextFilters = { ...state.filters };
    if (trimmed) {
      nextFilters[columnKey] = [trimmed];
    } else {
      delete nextFilters[columnKey];
    }
    onFiltersChange(nextFilters);
  };

  const setRangeFilterValue = (minKey: string, maxKey: string, side: 'min' | 'max', value: string) => {
    const nextFilters = { ...state.filters };
    const num = value.trim() === '' ? null : Number(value);
    const key = side === 'min' ? minKey : maxKey;
    if (num != null && Number.isFinite(num)) {
      nextFilters[key] = [num];
    } else {
      delete nextFilters[key];
    }
    onFiltersChange(nextFilters);
  };

  const clearRangeFilterBound = (key: string) => {
    const nextFilters = { ...state.filters };
    delete nextFilters[key];
    onFiltersChange(nextFilters);
  };

  const isRangeFilterBoundKey = (columnKey: string) =>
    rangeFilterDefs.some((d) => d.minKey === columnKey || d.maxKey === columnKey);

  const isDateRangeFilterBoundKey = (columnKey: string) =>
    dateRangeFilterDefs.some((d) => d.fromKey === columnKey || d.toKey === columnKey);

  const clearDateRangeFilter = (fromKey: string, toKey: string) => {
    const nextFilters = { ...state.filters };
    delete nextFilters[fromKey];
    delete nextFilters[toKey];
    onFiltersChange(nextFilters);
  };

  const effectiveActiveFilterCount = activeFilterCount + (showDeletedActive ? 1 : 0);


  const handleClearAllFilters = () => {
    onClearShowDeleted?.();
    onFiltersChange({});
  };

  const activeSearchFromValues = searchFromValue ?? searchFromOptions.map((option) => option.value);
  const searchFromEnabled = searchFromOptions.length > 1 && !!onSearchFromChange;
  const searchFromSummary = (() => {
    if (activeSearchFromValues.length === searchFromOptions.length) return 'All fields';
    if (activeSearchFromValues.length === 1) {
      return searchFromOptions.find((option) => option.value === activeSearchFromValues[0])?.label ?? 'Search from';
    }
    return `${activeSearchFromValues.length} fields`;
  })();

  const toggleSearchFromValue = (value: string) => {
    if (!onSearchFromChange) return;
    const next = activeSearchFromValues.includes(value)
      ? activeSearchFromValues.length === 1
        ? activeSearchFromValues
        : activeSearchFromValues.filter((item) => item !== value)
      : [...activeSearchFromValues, value];
    onSearchFromChange(next);
  };

  const labelClass = compact ? 'sr-only' : 'hidden md:inline';
  const controlBtnClass = (extra?: string) => cn(compact ? 'size-9 p-0' : 'h-10', controlClassName, extra);
  const iconClass = (extra?: string) => cn('h-4 w-4 shrink-0', !compact && 'md:mr-2', extra);

  const searchFromViewGroupsResolved = searchFromViewGroups ?? (
    searchFromOptions.length > 0
      ? [{ heading: 'Search in', options: searchFromOptions }]
      : []
  );

  const resolvedDefaultVisibleColumns = defaultVisibleColumns ?? state.defaultVisibleColumns;

  const toggleColumnVisibility = (
    group: DataTableColumnViewGroup,
    columnKey: string,
    checked: boolean,
  ) => {
    if (
      !checked &&
      group.visibleColumns.length === 1 &&
      group.visibleColumns.includes(columnKey)
    ) {
      return;
    }
    const next = checked
      ? [...group.visibleColumns, columnKey]
      : group.visibleColumns.filter((key) => key !== columnKey);
    group.onVisibleColumnsChange(
      ensureAtLeastOneVisibleColumn(
        next,
        group.columnDefinitions.map((column) => column.key),
      ),
    );
  };

  const handleVisibleColumnsChange = React.useCallback(
    (columns: string[]) => {
      onVisibleColumnsChange(
        ensureAtLeastOneVisibleColumn(
          columns,
          columnDefinitions.map((column) => column.key),
        ),
      );
    },
    [columnDefinitions, onVisibleColumnsChange],
  );

  const viewLayoutChangeCount = React.useMemo(() => {
    if (columnViewGroups.length > 0) {
      return countColumnViewLayoutDiff(columnViewGroups);
    }
    if (columnDefinitions.length === 0) {
      return 0;
    }
    if (!canResolveDefaultVisibleColumns(columnDefinitions, resolvedDefaultVisibleColumns)) {
      return 0;
    }
    const defaults = resolveDefaultVisibleColumns(columnDefinitions, resolvedDefaultVisibleColumns);
    return countVisibleColumnLayoutDiff(state.visibleColumns, defaults);
  }, [
    columnViewGroups,
    columnDefinitions,
    resolvedDefaultVisibleColumns,
    state.visibleColumns,
  ]);

  const handleResetViewLayout = React.useCallback(() => {
    if (columnViewGroups.length > 0) {
      columnViewGroups.forEach((group) => {
        if (!canResolveDefaultVisibleColumns(group.columnDefinitions, group.defaultVisibleColumns)) {
          return;
        }
        group.onVisibleColumnsChange(
          ensureAtLeastOneVisibleColumn(
            resolveDefaultVisibleColumns(group.columnDefinitions, group.defaultVisibleColumns),
            group.columnDefinitions.map((column) => column.key),
          ),
        );
      });
      return;
    }
    if (!canResolveDefaultVisibleColumns(columnDefinitions, resolvedDefaultVisibleColumns)) {
      return;
    }
    handleVisibleColumnsChange(
      resolveDefaultVisibleColumns(columnDefinitions, resolvedDefaultVisibleColumns),
    );
  }, [
    columnViewGroups,
    columnDefinitions,
    resolvedDefaultVisibleColumns,
    handleVisibleColumnsChange,
  ]);

  const searchFromControl = searchFromEnabled && !searchFromInView ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-7 shrink-0 rounded-full text-xs',
            compact ? 'size-7 px-0' : 'px-2',
            controlClassName,
          )}
          aria-label={`Search from ${searchFromSummary}`}
        >
          <Search className={cn('h-3.5 w-3.5 opacity-70', !compact && 'sm:mr-1')} />
          <span
            className={cn(
              'max-w-[9rem] truncate',
              compact ? 'sr-only' : 'hidden sm:inline',
            )}
          >
            {searchFromSummary}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px]">
        <DropdownMenuLabel>Search from</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {searchFromOptions.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={activeSearchFromValues.includes(option.value)}
            onCheckedChange={() => toggleSearchFromValue(option.value)}
            onSelect={(event) => event.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;
  const defaultSearchLeadingAccessory = (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
      <Search className="h-3.5 w-3.5" />
    </span>
  );
  const searchLeadingContent = searchLeadingAccessory ?? searchFromControl ?? defaultSearchLeadingAccessory;

  return (
    <div className={cn('flex w-full flex-col gap-2', compact && 'gap-1.5', className)}>
      <div
        className={cn(
          'flex items-center gap-2',
          compact ? 'flex-nowrap justify-center gap-1' : 'flex-wrap',
          rowClassName,
        )}
      >
        {/* Search */}
        {!hideSearch ? (
          <div
            className={cn(
              'flex h-10 min-w-0 flex-1 items-center rounded-md border border-input bg-background px-2 ring-offset-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
              compact && 'h-9',
              searchContainerClassName,
            )}
          >
            {searchLeadingContent}
            <Input
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className={cn(
                'h-full min-w-0 flex-1 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
                compact && 'text-sm',
                searchInputClassName,
              )}
            />
            {searchValue && (
              <button
                onClick={() => setSearchValue('')}
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : null}
        {!hideSearch && searchAccessory}

        <div
          className={cn(
            'flex shrink-0 items-center gap-2',
            hideSearch && (compact ? 'mx-auto justify-center' : 'w-full'),
          )}
        >
          {/* View Options (Columns + optional search-from groups) */}
          {(columnViewGroups.length > 0 ||
            columnDefinitions.length > 0 ||
            (searchFromInView &&
              (stemSearchFromOptions.length > 0 || searchFromViewGroupsResolved.length > 0))) && (
            <div className="relative flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={controlBtnClass()} aria-label="View options">
                  <LayoutGrid className={iconClass()} />
                  <span className={labelClass}>View</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[240px] p-0 max-h-[min(70vh,480px)] overflow-y-auto">
                {columnViewGroups.length > 0 ? (
                  columnViewGroups.map((group, groupIndex) => (
                    <div key={group.heading}>
                      {groupIndex > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuLabel className="px-2 py-1.5">{group.heading}</DropdownMenuLabel>
                      {group.columnDefinitions.map((col) => (
                        <DropdownMenuCheckboxItem
                          key={col.key}
                          checked={group.visibleColumns.includes(col.key)}
                          disabled={
                            group.visibleColumns.length === 1 && group.visibleColumns.includes(col.key)
                          }
                          onCheckedChange={(checked) =>
                            toggleColumnVisibility(group, col.key, checked === true)
                          }
                          onSelect={(event) => event.preventDefault()}
                          className="pl-8"
                        >
                          {col.label}
                        </DropdownMenuCheckboxItem>
                      ))}
                    </div>
                  ))
                ) : (
                  columnDefinitions.length > 0 && (
                    <>
                      <DropdownMenuLabel className="px-2 py-1.5">
                        {searchFromInView && searchFromViewGroupsResolved.length > 0
                          ? 'Question stems'
                          : 'Show columns'}
                      </DropdownMenuLabel>
                      <SearchableSelectInline<DataTableColumnDefinition>
                        items={columnDefinitions}
                        value={columnDefinitions.filter((c) => state.visibleColumns.includes(c.key))}
                        onValueChange={(cols) => {
                          if (cols.length === 0) {
                            return;
                          }
                          handleVisibleColumnsChange(cols.map((c) => c.key));
                        }}
                        getItemId={(c) => c.key}
                        getItemLabel={(c) => c.label}
                        searchPlaceholder="Search columns..."
                        emptyMessage="No columns found"
                        multiSelect
                      />
                      {searchFromInView &&
                        stemSearchFromOptions.map((option) => (
                          <DropdownMenuCheckboxItem
                            key={option.value}
                            checked={activeSearchFromValues.includes(option.value)}
                            onCheckedChange={() => toggleSearchFromValue(option.value)}
                            className="pl-8"
                          >
                            {option.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                    </>
                  )
                )}
                {searchFromInView && searchFromViewGroupsResolved.length > 0 && onSearchFromChange && (
                  <>
                    {(columnViewGroups.length > 0 || columnDefinitions.length > 0) && (
                      <DropdownMenuSeparator />
                    )}
                    {searchFromViewGroupsResolved.map((group, groupIndex) => (
                      <div key={group.heading}>
                        {groupIndex > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuLabel className="px-2 py-1.5">{group.heading}</DropdownMenuLabel>
                        {group.options.map((option) => (
                          <DropdownMenuCheckboxItem
                            key={option.value}
                            checked={activeSearchFromValues.includes(option.value)}
                            onCheckedChange={() => toggleSearchFromValue(option.value)}
                            className="pl-8"
                          >
                            {option.label}
                          </DropdownMenuCheckboxItem>
                        ))}
                      </div>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {viewLayoutChangeCount > 0 ? (
              <ToolbarActiveBadge
                onClear={handleResetViewLayout}
                ariaLabel="Reset column layout to default"
              >
                {viewLayoutChangeCount}
              </ToolbarActiveBadge>
            ) : null}
            </div>
          )}

          {/* Group By */}
          {groupByOptions.length > 0 && (
            <div className="relative flex items-center">
              <DropdownMenu open={groupByOpen} onOpenChange={setGroupByOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={controlBtnClass()} aria-label="Group by">
                    <Layers className={iconClass()} />
                    <span className={labelClass}>
                      {state.groupBy
                        ? groupByOptions.find((o) => o.key === state.groupBy)?.label ?? 'Grouped'
                        : 'Group by'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px] p-0">
                  <DropdownMenuLabel className="px-2 py-1.5">Group by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <SearchableSelectInline<DataTableGroupByOption>
                    items={groupByOptions}
                    value={state.groupBy ? groupByOptions.find((o) => o.key === state.groupBy) ?? null : null}
                    onValueChange={(opt) => {
                      onGroupByChange(opt?.key ?? null);
                      setGroupByOpen(false);
                    }}
                    getItemId={(o) => o.key}
                    getItemLabel={(o) => o.label}
                    searchPlaceholder="Search..."
                    emptyMessage="No options found"
                    allowClear
                    clearLabel="None"
                  />
                </DropdownMenuContent>
              </DropdownMenu>
              {state.groupBy ? (
                <ToolbarActiveBadge onClear={() => onGroupByChange(null)} ariaLabel="Clear group by">
                  1
                </ToolbarActiveBadge>
              ) : null}
            </div>
          )}

          {/* Sort By */}
          {sortOptions.length > 0 && (
            <div className="relative flex shrink-0 items-center">
              <DropdownMenu open={sortOpen} onOpenChange={setSortOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={controlBtnClass()}
                    aria-label="Sort"
                  >
                    <ArrowUpDown className={iconClass()} />
                    <span className={labelClass}>Sort</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[240px]">
                  <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {sortOptions.map((option) => {
                    const selected = state.sortBy === option.key;
                    return (
                      <DropdownMenuItem
                        key={option.key}
                        className="flex items-center gap-2"
                        onSelect={(event) => {
                          if (selected) {
                            event.preventDefault();
                            return;
                          }
                          onSortChange(option.key, 'asc');
                          setSortOpen(false);
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">{option.label}</span>
                        {selected ? (
                          <button
                            type="button"
                            className="inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2 text-xs hover:bg-muted"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              onSortChange(option.key, state.sortDirection === 'asc' ? 'desc' : 'asc');
                            }}
                            aria-label={state.sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
                          >
                            {state.sortDirection === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )}
                            {state.sortDirection === 'asc' ? 'Asc' : 'Desc'}
                          </button>
                        ) : null}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
              {state.sortBy ? (
                <ToolbarActiveBadge
                  onClear={() => onSortChange(null, 'desc')}
                  ariaLabel={`Clear sort by ${sortOptions.find((o) => o.key === state.sortBy)?.label ?? state.sortBy}`}
                  className="max-w-28 min-w-0"
                >
                  <span className="inline-flex min-w-0 max-w-full items-center gap-0.5">
                    <span className="min-w-0 flex-1 truncate">
                      {sortOptions.find((o) => o.key === state.sortBy)?.label ?? 'Sorted'}
                    </span>
                    {state.sortDirection === 'asc' ? (
                      <ArrowUp className="h-3 w-3 shrink-0" />
                    ) : (
                      <ArrowDown className="h-3 w-3 shrink-0" />
                    )}
                  </span>
                </ToolbarActiveBadge>
              ) : null}
            </div>
          )}

          {/* Filters */}
          <div className="relative flex items-center">
            <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={controlBtnClass()}
                  aria-label={`Filter${effectiveActiveFilterCount > 0 ? ` (${effectiveActiveFilterCount})` : ''}`}
                >
                  <Filter className={iconClass()} />
                  <span className={labelClass}>Filter</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[260px] max-h-[500px] overflow-hidden flex flex-col">
                <DropdownMenuLabel>Filters</DropdownMenuLabel>
                
                {quickFilters.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Quick Filters
                    </div>
                    <div className="px-2 pb-2 flex flex-wrap gap-1">
                      {quickFilters.map((qf) => (
                        <Button
                          key={qf.id}
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => onQuickFilterApply(qf)}
                        >
                          {qf.name}
                        </Button>
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}

                {(effectiveActiveFilterCount > 0 || showDeletedActive) && (
                  <div className="px-2 pb-2 flex flex-wrap items-center gap-1">
                    {dateRangeFilterDefs.map((def) => {
                      if (!def.fromKey || !def.toKey) return null;
                      const fromVal = String((state.filters[def.fromKey] ?? [])[0] ?? '');
                      const toVal = String((state.filters[def.toKey] ?? [])[0] ?? '');
                      const fromSet = fromVal.trim() !== '';
                      const toSet = toVal.trim() !== '';
                      if (!fromSet && !toSet) return null;
                      const label = def.label;
                      return (
                        <div
                          key={def.key}
                          className="flex flex-wrap items-center gap-1 p-1 bg-muted/50 rounded border text-[10px]"
                        >
                          <span>{label}:</span>
                          <button
                            onClick={() => clearDateRangeFilter(def.fromKey!, def.toKey!)}
                            className="inline-flex items-center gap-0.5 px-1 bg-background hover:bg-muted rounded border group"
                            aria-label={`Clear ${label}`}
                          >
                            {fromSet && toSet
                              ? `${fromVal} – ${toVal}`
                              : fromSet
                                ? `from ${fromVal}`
                                : `to ${toVal}`}
                            <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                          </button>
                        </div>
                      );
                    })}
                    {rangeFilterDefs.map((def) => {
                      const minVal = def.minKey != null ? (state.filters[def.minKey]?.[0] ?? '') : '';
                      const maxVal = def.maxKey != null ? (state.filters[def.maxKey]?.[0] ?? '') : '';
                      const minSet = minVal !== '' && minVal != null && String(minVal).trim() !== '';
                      const maxSet = maxVal !== '' && maxVal != null && String(maxVal).trim() !== '';
                      const nullSet =
                        !!def.nullOptionLabel &&
                        (state.filters[def.key] ?? []).some((v) => String(v) === '__null__');
                      if (!minSet && !maxSet && !nullSet) return null;
                      const label = def.label;
                      return (
                        <div key={def.key} className="flex flex-wrap items-center gap-1 p-1 bg-muted/50 rounded border text-[10px]">
                          {nullSet ? (
                            <>
                              <span className="font-semibold">{label} is</span>
                              <button
                                onClick={() => clearRangeFilterBound(def.key)}
                                className="inline-flex items-center gap-0.5 px-1 bg-background hover:bg-muted rounded border group"
                                aria-label={`Clear ${def.nullOptionLabel}`}
                              >
                                {def.nullOptionLabel}
                                <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                              </button>
                              {(minSet || maxSet) && <span className="opacity-50">OR</span>}
                            </>
                          ) : null}
                          {minSet && maxSet ? (
                            <>
                              {!nullSet && <span>{label} is between</span>}
                              {nullSet && <span>between</span>}
                              <button
                                onClick={() => def.minKey && clearRangeFilterBound(def.minKey)}
                                className="inline-flex items-center gap-0.5 px-1 bg-background hover:bg-muted rounded border group"
                                aria-label={`Clear ${label} min`}
                              >
                                {String(minVal)}
                                <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                              </button>
                              <span>and</span>
                              <button
                                onClick={() => def.maxKey && clearRangeFilterBound(def.maxKey)}
                                className="inline-flex items-center gap-0.5 px-1 bg-background hover:bg-muted rounded border group"
                                aria-label={`Clear ${label} max`}
                              >
                                {String(maxVal)}
                                <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                              </button>
                              <span>(inclusive)</span>
                            </>
                          ) : minSet ? (
                            <>
                              {!nullSet && <span>{label} is more than or equal to</span>}
                              {nullSet && <span>≥</span>}
                              <button
                                onClick={() => def.minKey && clearRangeFilterBound(def.minKey)}
                                className="inline-flex items-center gap-0.5 px-1 bg-background hover:bg-muted rounded border group"
                                aria-label={`Clear ${label} min`}
                              >
                                {String(minVal)}
                                <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                              </button>
                            </>
                          ) : maxSet ? (
                            <>
                              {!nullSet && <span>{label} is less than or equal to</span>}
                              {nullSet && <span>≤</span>}
                              <button
                                onClick={() => def.maxKey && clearRangeFilterBound(def.maxKey)}
                                className="inline-flex items-center gap-0.5 px-1 bg-background hover:bg-muted rounded border group"
                                aria-label={`Clear ${label} max`}
                              >
                                {String(maxVal)}
                                <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                              </button>
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                    {Object.entries(state.filters).map(([columnKey, selected]) => {
                      if (isRangeFilterBoundKey(columnKey)) return null;
                      if (isDateRangeFilterBoundKey(columnKey)) return null;
                      const def = filterDefinitions.find((d) => d.key === columnKey);
                      if (def?.type === 'number-range') return null;
                      if (!selected?.length) return null;
                      const label = def?.label ?? columnKey;

                      return (
                        <div key={columnKey} className="flex flex-wrap items-center gap-1 p-1 bg-muted/50 rounded border text-[10px]">
                          <span className="font-semibold">{label} is</span>
                          {selected.map((val: unknown, idx: number) => {
                            const opt = def?.options?.find((o: DataTableFilterOption<unknown>) => String(o.value) === String(val));
                            const valLabel = opt?.label ?? String(val);
                            return (
                              <React.Fragment key={String(val)}>
                                {idx > 0 && <span className="opacity-50">OR</span>}
                                <button
                                  onClick={() => removeFilterValue(columnKey, val)}
                                  className="inline-flex items-center gap-1 px-1 bg-background hover:bg-muted rounded border group"
                                >
                                  {valLabel}
                                  <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                                </button>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      );
                    })}
                    {showDeletedActive && (
                      <div className="flex flex-wrap items-center gap-1 p-1 bg-muted/50 rounded border text-[10px]">
                        <span className="font-semibold">Deleted</span>
                        <button
                          onClick={() => onClearShowDeleted?.()}
                          className="inline-flex items-center gap-1 px-1 bg-background hover:bg-muted rounded border group"
                          aria-label="Clear Deleted filter"
                        >
                          <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                        </button>
                      </div>
                    )}
                    <button
                      onClick={handleClearAllFilters}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-muted hover:bg-muted/80 rounded border text-[10px] font-medium transition-colors"
                    >
                      Clear all
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}

                <DropdownMenuSeparator />

                <ScrollArea className="flex-1 overflow-y-auto">
                  {filterDefinitions
                    .filter((def) => def.type !== 'date')
                    .map((def) => {
                    const customContent = customFilterContent[def.key];
                    if (customContent != null) {
                      return (
                        <DropdownMenuSub
                          key={def.key}
                          persistOpenOnRemountKey={`${filterPersistenceKey}:filter:${def.key}`}
                        >
                          <DropdownMenuSubTrigger>{def.label}</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-[280px] p-0">
                            {customContent}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      );
                    }
                    if (def.type === 'date-range' && def.fromKey && def.toKey) {
                      const fromVal = String((state.filters[def.fromKey] ?? [])[0] ?? '');
                      const toVal = String((state.filters[def.toKey] ?? [])[0] ?? '');
                      return (
                        <DropdownMenuSub
                          key={def.key}
                          persistOpenOnRemountKey={`${filterPersistenceKey}:date:${def.key}`}
                        >
                          <DropdownMenuSubTrigger>{def.label}</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-[260px] p-0">
                            <DateRangeFilter
                              fromValue={fromVal}
                              toValue={toVal}
                              onFromChange={(v) =>
                                setSingleFilterValue(def.fromKey!, v)
                              }
                              onToChange={(v) =>
                                setSingleFilterValue(def.toKey!, v)
                              }
                              onRangeChange={(from, to) => {
                                const next = { ...state.filters };
                                if (from) next[def.fromKey!] = [from];
                                else delete next[def.fromKey!];
                                if (to) next[def.toKey!] = [to];
                                else delete next[def.toKey!];
                                onFiltersChange(next);
                              }}
                            />
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      );
                    }
                    if (def.type === 'number-range' && def.minKey && def.maxKey) {
                      const minKey = def.minKey;
                      const maxKey = def.maxKey;
                      const minVal = String((state.filters[minKey] ?? [])[0] ?? '');
                      const maxVal = String((state.filters[maxKey] ?? [])[0] ?? '');
                      const nullSelected =
                        !!def.nullOptionLabel &&
                        (state.filters[def.key] ?? []).some((v) => String(v) === '__null__');
                      return (
                        <DropdownMenuSub key={def.key}>
                          <DropdownMenuSubTrigger>{def.label}</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-[200px]">
                            {def.nullOptionLabel ? (
                              <>
                                <DropdownMenuCheckboxItem
                                  checked={nullSelected}
                                  onCheckedChange={(checked) => {
                                    const nextFilters = { ...state.filters };
                                    if (checked) {
                                      nextFilters[def.key] = ['__null__'];
                                    } else {
                                      delete nextFilters[def.key];
                                    }
                                    onFiltersChange(nextFilters);
                                  }}
                                  onSelect={(e) => e.preventDefault()}
                                >
                                  {def.nullOptionLabel}
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuSeparator />
                              </>
                            ) : null}
                            <div className="p-2 flex items-center gap-2">
                              <div className="flex-1 min-w-0">
                                <label className="text-xs font-medium text-muted-foreground">Min</label>
                                <Input
                                  type="number"
                                  placeholder="Min"
                                  value={minVal}
                                  onChange={(e) => setRangeFilterValue(minKey, maxKey, 'min', e.target.value)}
                                  className="h-8 w-full mt-1"
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <label className="text-xs font-medium text-muted-foreground">Max</label>
                                <Input
                                  type="number"
                                  placeholder="Max"
                                  value={maxVal}
                                  onChange={(e) => setRangeFilterValue(minKey, maxKey, 'max', e.target.value)}
                                  className="h-8 w-full mt-1"
                                />
                              </div>
                            </div>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      );
                    }

                    const options = def.options ?? [];
                    const selectedOptions = options.filter((opt: DataTableFilterOption<unknown>) =>
                      (state.filters[def.key] ?? []).some((v: unknown) => String(v) === String(opt.value))
                    );
                    const isSearchable = def.searchable && !!onFilterSearchChange;

                    return (
                      <DropdownMenuSub key={def.key}>
                        <DropdownMenuSubTrigger>{def.label}</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-[240px] p-0">
                          <SearchableSelectInline<DataTableFilterOption<unknown>>
                            items={options}
                            value={selectedOptions}
                            onValueChange={(opts) => {
                              const next = opts.map((o) => o.value);
                              const nextFilters = { ...state.filters };
                              if (next.length > 0) {
                                nextFilters[def.key] = next;
                              } else {
                                delete nextFilters[def.key];
                              }
                              onFiltersChange(nextFilters);
                            }}
                            getItemId={(o) => String(o.value)}
                            getItemLabel={(o) => o.label}
                            searchPlaceholder={def.searchPlaceholder ?? `Search ${def.label.toLowerCase()}...`}
                            emptyMessage="No results found"
                            multiSelect
                            onSearchChange={isSearchable ? (q) => onFilterSearchChange?.(def.key, q) : undefined}
                          />
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  })}
                </ScrollArea>
                {filterFooter != null && (
                  <>
                    <DropdownMenuSeparator />
                    {filterFooter}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            {effectiveActiveFilterCount > 0 ? (
              <ToolbarActiveBadge onClear={handleClearAllFilters} ariaLabel="Clear all filters">
                {effectiveActiveFilterCount}
              </ToolbarActiveBadge>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
