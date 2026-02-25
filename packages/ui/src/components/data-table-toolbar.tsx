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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { ScrollArea } from './scroll-area';
import { Checkbox } from './checkbox';
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
  filterSearchValues = {},
  onFilterSearchChange,
}: DataTableToolbarProps) {
  const [searchValue, setSearchValue] = React.useState(state.search);
  const debouncedSearch = useDebounce(searchValue, 300);
  const prevStateSearchRef = React.useRef(state.search);
  const isInternalUpdateRef = React.useRef(false);

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
  const activeFilterCount: number = (() => {
    let count = 0;
    for (const [key, arr] of Object.entries(state.filters)) {
      const def = filterDefinitions.find((d) => d.key === key || d.minKey === key || d.maxKey === key);
      if (def?.type === 'number-range') continue;
      count += Array.isArray(arr) ? arr.length : 0;
    }
    for (const def of rangeFilterDefs) {
      const minArr = def.minKey ? state.filters[def.minKey] : [];
      const maxArr = def.maxKey ? state.filters[def.maxKey] : [];
      const minSet = Array.isArray(minArr) && minArr.length > 0 && minArr[0] != null && minArr[0] !== '';
      const maxSet = Array.isArray(maxArr) && maxArr.length > 0 && maxArr[0] != null && maxArr[0] !== '';
      if (minSet || maxSet) count += 1;
    }
    return count;
  })();

  const togglePillVisibility = (key: string) => {
    const next = state.visibleColumns.includes(key)
      ? state.visibleColumns.filter((k: string) => k !== key)
      : [...state.visibleColumns, key];
    onVisibleColumnsChange(next);
  };

  const toggleFilterValue = (columnKey: string, value: unknown) => {
    const current = state.filters[columnKey] ?? [];
    const next = current.some((v: unknown) => v === value)
      ? current.filter((v: unknown) => v !== value)
      : [...current, value];

    const nextFilters = { ...state.filters, [columnKey]: next.filter((v: unknown) => v != null) };
    if (next.length === 0) {
      delete nextFilters[columnKey];
    }
    onFiltersChange(nextFilters);
  };

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

  const clearRangeFilter = (minKey: string, maxKey: string) => {
    const nextFilters = { ...state.filters };
    delete nextFilters[minKey];
    delete nextFilters[maxKey];
    onFiltersChange(nextFilters);
  };

  const clearRangeFilterBound = (key: string) => {
    const nextFilters = { ...state.filters };
    delete nextFilters[key];
    onFiltersChange(nextFilters);
  };

  const isRangeFilterBoundKey = (columnKey: string) =>
    rangeFilterDefs.some((d) => d.minKey === columnKey || d.maxKey === columnKey);

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
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

        <div className="flex items-center gap-1">
          {/* View Options (Columns) */}
          {columnDefinitions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">View</span>
                  <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columnDefinitions.map((col) => {
                  const isVisible = state.visibleColumns.includes(col.key);
                  return (
                    <DropdownMenuItem
                      key={col.key}
                      onSelect={(e) => {
                        e.preventDefault();
                        togglePillVisibility(col.key);
                      }}
                      className="flex items-center gap-2 py-1.5 pl-2 pr-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={isVisible}
                        aria-label={col.label}
                        tabIndex={-1}
                        className="pointer-events-none"
                      />
                      <span>{col.label}</span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Group By */}
          {groupByOptions.length > 0 && (
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9", state.groupBy && "rounded-r-none")}>
                    <Layers className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">
                      {state.groupBy 
                        ? groupByOptions.find(o => o.key === state.groupBy)?.label ?? 'Grouped'
                        : 'Group by'}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                  <DropdownMenuItem onClick={() => onGroupByChange(null)}>None</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {groupByOptions.map((o) => (
                    <DropdownMenuItem key={o.key} onClick={() => onGroupByChange(o.key)}>
                      {o.label}
                    </DropdownMenuItem>
                  ))}
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-9 flex-nowrap shrink-0",
                      state.sortBy && "rounded-r-none min-w-[7.5rem]"
                    )}
                  >
                    <ArrowUpDown className="h-4 w-4 mr-2 shrink-0" />
                    <span className="hidden sm:inline-flex items-center gap-1 flex-nowrap shrink-0 whitespace-nowrap">
                      {state.sortBy ? (
                        <>
                          <span className="min-w-0 truncate">{sortOptions.find(o => o.key === state.sortBy)?.label ?? 'Sorted'}</span>
                          {state.sortDirection === 'asc' ? <ArrowUp className="h-3.5 w-3.5 shrink-0" /> : <ArrowDown className="h-3.5 w-3.5 shrink-0" />}
                        </>
                      ) : (
                        'Sort by'
                      )}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-1 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  {sortOptions.map((o) => (
                    <DropdownMenuItem
                      key={o.key}
                      onClick={() => {
                        const nextDir = state.sortBy === o.key && state.sortDirection === 'asc' ? 'desc' : 'asc';
                        onSortChange(o.key, nextDir);
                      }}
                      className="flex items-center gap-2"
                    >
                      <span>{o.label}</span>
                      {state.sortBy === o.key && (
                        <span className="ml-auto">
                          {state.sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 opacity-70" /> : <ArrowDown className="h-4 w-4 opacity-70" />}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {state.sortBy && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-l-none border-l-0 px-2"
                  onClick={() => onSortChange(null, 'desc')}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-9", activeFilterCount > 0 && "rounded-r-none")}>
                  <Filter className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">
                    Filter {activeFilterCount > 0 && `(${activeFilterCount})`}
                  </span>
                  <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[320px] max-h-[500px] overflow-hidden flex flex-col">
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

                {activeFilterCount > 0 && (
                  <div className="px-2 pb-2 flex flex-wrap items-center gap-1">
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
                                {minVal}
                                <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                              </button>
                              <span>and</span>
                              <button
                                onClick={() => def.maxKey && clearRangeFilterBound(def.maxKey)}
                                className="inline-flex items-center gap-0.5 px-1 bg-background hover:bg-muted rounded border group"
                                aria-label={`Clear ${label} max`}
                              >
                                {maxVal}
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
                                {minVal}
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
                                {maxVal}
                                <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                              </button>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {Object.entries(state.filters).map(([columnKey, selected]) => {
                      if (isRangeFilterBoundKey(columnKey)) return null;
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
                    <button
                      onClick={() => onFiltersChange({})}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-muted hover:bg-muted/80 rounded border text-[10px] font-medium transition-colors"
                    >
                      Clear all
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}

                <DropdownMenuSeparator />
                {filterDefinitions.some((def) => def.type === 'date') && (
                  <>
                    <div className="px-2 py-2 grid grid-cols-2 gap-2">
                      {filterDefinitions.filter((def) => def.type === 'date').map((def) => {
                        const currentValue = String((state.filters[def.key] ?? [])[0] ?? '');
                        return (
                          <div key={def.key}>
                            <label className="text-xs font-medium text-muted-foreground">{def.label}</label>
                            <Input
                              type="date"
                              value={currentValue}
                              onChange={(e) => setSingleFilterValue(def.key, e.target.value)}
                              className="h-8 mt-1"
                            />
                          </div>
                        );
                      })}
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}

                <ScrollArea className="flex-1 overflow-y-auto">
                  {filterDefinitions.filter((def) => def.type !== 'date').map((def) => {
                    if (def.type === 'number-range' && def.minKey && def.maxKey) {
                      const minKey = def.minKey;
                      const maxKey = def.maxKey;
                      const minVal = String((state.filters[minKey] ?? [])[0] ?? '');
                      const maxVal = String((state.filters[maxKey] ?? [])[0] ?? '');
                      return (
                        <DropdownMenuSub key={def.key}>
                          <DropdownMenuSubTrigger>{def.label}</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-[220px]">
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

                    const isSearchable = def.searchable && !!onFilterSearchChange;
                    const filterSearchValue = filterSearchValues[def.key] ?? '';

                    if (isSearchable) {
                      return (
                        <DropdownMenuSub key={def.key}>
                          <DropdownMenuSubTrigger>{def.label}</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-[280px]">
                            <div className="p-2 border-b">
                              <Input
                                value={filterSearchValue}
                                onChange={(e) => onFilterSearchChange(def.key, e.target.value)}
                                placeholder={def.searchPlaceholder || `Search ${def.label.toLowerCase()}...`}
                                className="h-8"
                              />
                            </div>
                            <ScrollArea className="max-h-[260px]">
                              {(def.options ?? []).length === 0 ? (
                                <div className="px-2 py-3 text-xs text-muted-foreground">No results</div>
                              ) : (
                                (def.options ?? []).map((opt: DataTableFilterOption<unknown>) => {
                                  const isSelected = (state.filters[def.key] ?? []).some((v: unknown) => String(v) === String(opt.value));
                                  return (
                                    <DropdownMenuItem
                                      key={String(opt.value)}
                                      onSelect={(e) => {
                                        e.preventDefault();
                                        toggleFilterValue(def.key, opt.value);
                                      }}
                                      className="flex items-center gap-2 py-1.5 pl-2 pr-2 cursor-pointer"
                                    >
                                      <Checkbox
                                        checked={isSelected}
                                        aria-label={opt.label}
                                        tabIndex={-1}
                                        className="pointer-events-none"
                                      />
                                      <span>{opt.label}</span>
                                    </DropdownMenuItem>
                                  );
                                })
                              )}
                            </ScrollArea>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      );
                    }

                    return (
                      <DropdownMenuSub key={def.key}>
                        <DropdownMenuSubTrigger>{def.label}</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent className="w-[200px]">
                          <ScrollArea className="max-h-[300px]">
                            {(def.options ?? []).map((opt: DataTableFilterOption<unknown>) => {
                              const isSelected = (state.filters[def.key] ?? []).some((v: unknown) => String(v) === String(opt.value));
                              return (
                                <DropdownMenuItem
                                  key={String(opt.value)}
                                  onSelect={(e) => {
                                    e.preventDefault();
                                    toggleFilterValue(def.key, opt.value);
                                  }}
                                  className="flex items-center gap-2 py-1.5 pl-2 pr-2 cursor-pointer"
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    aria-label={opt.label}
                                    tabIndex={-1}
                                    className="pointer-events-none"
                                  />
                                  <span>{opt.label}</span>
                                </DropdownMenuItem>
                              );
                            })}
                          </ScrollArea>
                        </DropdownMenuSubContent>
                      </DropdownMenuSub>
                    );
                  })}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-l-none border-l-0 px-2"
                onClick={() => onFiltersChange({})}
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
