'use client';

import * as React from 'react';
import {
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  ChevronDown,
  Search,
  Layers,
} from 'lucide-react';
import {
  DataTableState,
  QuickFilter,
  DataTableFilterDefinition,
  DataTableFilterOption,
  DataTableSortOption,
  DataTableGroupByOption,
  DataTableColumnDefinition,
  useDebounce,
} from '@altitutor/shared';
import { Button } from './button';
import { Input } from './input';
import {
  DropdownMenu,
  DropdownMenuContent,
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
import { cn } from '../lib/cn';

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
  quickFilters?: QuickFilter[];
  
  searchPlaceholder?: string;
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
  quickFilters = [],
  searchPlaceholder = 'Search...',
  isLoading: _isLoading = false,
  filterSearchValues: _filterSearchValues = {},
  onFilterSearchChange,
  filterFooter,
  showDeletedActive = false,
  onClearShowDeleted,
  customFilterContent = {},
}: DataTableToolbarProps) {
  const [searchValue, setSearchValue] = React.useState(state.search);
  const debouncedSearch = useDebounce(searchValue, 300);
  const prevStateSearchRef = React.useRef(state.search);
  const isInternalUpdateRef = React.useRef(false);
  const [groupByOpen, setGroupByOpen] = React.useState(false);
  const [sortOpen, setSortOpen] = React.useState(false);

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

  // Call onSearchChange when debounced value changes
  React.useEffect(() => {
    // Only trigger if the debounced value is different from the current state search
    if (debouncedSearch !== state.search) {
      isInternalUpdateRef.current = true;
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, onSearchChange, state.search]);

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
      if (minSet || maxSet) count += 1;
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

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[120px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 h-9"
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {/* View Options (Columns) */}
          {columnDefinitions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">View</span>
                  <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px] p-0">
                <DropdownMenuLabel className="px-2 py-1.5">Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <SearchableSelectInline<DataTableColumnDefinition>
                  items={columnDefinitions}
                  value={columnDefinitions.filter((c) => state.visibleColumns.includes(c.key))}
                  onValueChange={(cols) => onVisibleColumnsChange(cols.map((c) => c.key))}
                  getItemId={(c) => c.key}
                  getItemLabel={(c) => c.label}
                  searchPlaceholder="Search columns..."
                  emptyMessage="No columns found"
                  multiSelect
                />
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Group By */}
          {groupByOptions.length > 0 && (
            <div className="flex items-center">
              <DropdownMenu open={groupByOpen} onOpenChange={setGroupByOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9", state.groupBy && "rounded-r-none")}>
                    <Layers className="h-4 w-4 mr-2" />
                    <span className="hidden md:inline">
                      {state.groupBy
                        ? groupByOptions.find((o) => o.key === state.groupBy)?.label ?? 'Grouped'
                        : 'Group by'}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
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
              {state.groupBy && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-l-none border-l-0 px-2"
                  onClick={() => onGroupByChange(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Sort By */}
          {sortOptions.length > 0 && (
            <div className="flex items-center shrink-0">
              <DropdownMenu open={sortOpen} onOpenChange={setSortOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-9 flex-nowrap shrink-0",
                      state.sortBy && "rounded-r-none"
                    )}
                  >
                    <ArrowUpDown className="h-4 w-4 mr-2 shrink-0" />
                    <span className="hidden md:inline-flex items-center gap-1 flex-nowrap shrink-0 whitespace-nowrap">
                      {state.sortBy ? (
                        <span className="min-w-0 truncate">{sortOptions.find((o) => o.key === state.sortBy)?.label ?? 'Sorted'}</span>
                      ) : (
                        'Sort by'
                      )}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-1 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px] p-0">
                  <DropdownMenuLabel className="px-2 py-1.5">Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <SearchableSelectInline<DataTableSortOption>
                    items={sortOptions}
                    value={state.sortBy ? sortOptions.find((o) => o.key === state.sortBy) ?? null : null}
                    onValueChange={(opt) => {
                      if (opt) {
                        const nextDir =
                          state.sortBy === opt.key
                            ? state.sortDirection === 'asc'
                              ? 'desc'
                              : 'asc'
                            : 'asc';
                        onSortChange(opt.key, nextDir);
                      } else {
                        onSortChange(null, 'desc');
                      }
                      setSortOpen(false);
                    }}
                    getItemId={(o) => o.key}
                    getItemLabel={(o) => o.label}
                    searchPlaceholder="Search sort options..."
                    emptyMessage="No options found"
                    allowClear
                    clearLabel="None"
                  />
                </DropdownMenuContent>
              </DropdownMenu>
              {state.sortBy && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-none border-l-0 px-2"
                    onClick={() =>
                      onSortChange(state.sortBy, state.sortDirection === 'asc' ? 'desc' : 'asc')
                    }
                    aria-label={state.sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
                  >
                    {state.sortDirection === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-l-none border-l-0 px-2"
                    onClick={() => onSortChange(null, 'desc')}
                    aria-label="Clear sort"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9", effectiveActiveFilterCount > 0 && "rounded-r-none")}>
                  <Filter className="h-4 w-4 mr-2" />
                  <span className="hidden md:inline">
                    Filter {effectiveActiveFilterCount > 0 && `(${effectiveActiveFilterCount})`}
                  </span>
                  <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
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
                      if (!minSet && !maxSet) return null;
                      const label = def.label;
                      return (
                        <div key={def.key} className="flex flex-wrap items-center gap-1 p-1 bg-muted/50 rounded border text-[10px]">
                          {minSet && maxSet ? (
                            <>
                              <span>{label} is between</span>
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
                              <span>{label} is more than or equal to</span>
                              <button
                                onClick={() => def.minKey && clearRangeFilterBound(def.minKey)}
                                className="inline-flex items-center gap-0.5 px-1 bg-background hover:bg-muted rounded border group"
                                aria-label={`Clear ${label} min`}
                              >
                                {String(minVal)}
                                <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                              </button>
                            </>
                          ) : (
                            <>
                              <span>{label} is less than or equal to</span>
                              <button
                                onClick={() => def.maxKey && clearRangeFilterBound(def.maxKey)}
                                className="inline-flex items-center gap-0.5 px-1 bg-background hover:bg-muted rounded border group"
                                aria-label={`Clear ${label} max`}
                              >
                                {String(maxVal)}
                                <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                              </button>
                            </>
                          )}
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
                    if (def.type === 'date-range' && def.fromKey && def.toKey) {
                      const fromVal = String((state.filters[def.fromKey] ?? [])[0] ?? '');
                      const toVal = String((state.filters[def.toKey] ?? [])[0] ?? '');
                      return (
                        <DropdownMenuSub key={def.key}>
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
                    const customContent = customFilterContent[def.key];
                    if (customContent != null) {
                      return (
                        <DropdownMenuSub key={def.key}>
                          <DropdownMenuSubTrigger>{def.label}</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-[240px] p-0">
                            {customContent}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      );
                    }
                    if (def.type === 'number-range' && def.minKey && def.maxKey) {
                      const minKey = def.minKey;
                      const maxKey = def.maxKey;
                      const minVal = String((state.filters[minKey] ?? [])[0] ?? '');
                      const maxVal = String((state.filters[maxKey] ?? [])[0] ?? '');
                      return (
                        <DropdownMenuSub key={def.key}>
                          <DropdownMenuSubTrigger>{def.label}</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-[200px]">
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
            {effectiveActiveFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-l-none border-l-0 px-2"
                onClick={handleClearAllFilters}
                aria-label="Clear all filters"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
