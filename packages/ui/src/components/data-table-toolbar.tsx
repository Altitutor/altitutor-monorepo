'use client';

import * as React from 'react';
import { 
  LayoutGrid, 
  ArrowUpDown, 
  Filter, 
  X, 
  ChevronDown,
  Search,
  Check,
  Layers
} from 'lucide-react';
import { 
  DataTableState, 
  QuickFilter, 
  DataTableFilterDefinition,
  DataTableSortOption,
  DataTableGroupByOption,
  DataTableColumnDefinition,
  useDebounce
} from '@altitutor/shared';
import { Button } from './button';
import { Input } from './input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { ScrollArea } from './scroll-area';
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
}

export function DataTableToolbar({
  state,
  onSearchChange,
  onFiltersChange,
  onSortChange,
  onGroupByChange,
  onVisibleColumnsChange,
  onQuickFilterApply,
  onReset,
  filterDefinitions = [],
  sortOptions = [],
  groupByOptions = [],
  columnDefinitions = [],
  quickFilters = [],
  searchPlaceholder = 'Search...',
  isLoading = false,
}: DataTableToolbarProps) {
  const [searchValue, setSearchValue] = React.useState(state.search);
  const debouncedSearch = useDebounce(searchValue, 300);

  // Sync internal search state with prop state (e.g. if cleared from outside)
  // We only sync if the value is actually different to avoid unnecessary cycles
  React.useEffect(() => {
    if (state.search !== searchValue) {
      setSearchValue(state.search);
    }
  }, [state.search]);

  // Call onSearchChange when debounced value changes
  React.useEffect(() => {
    // Only trigger if the debounced value is different from the current state search
    if (debouncedSearch !== state.search) {
      onSearchChange(debouncedSearch);
    }
  }, [debouncedSearch, onSearchChange, state.search]);

  const activeFilterCount = Object.values(state.filters).reduce((acc, arr) => acc + (arr?.length ?? 0), 0);

  const togglePillVisibility = (key: string) => {
    const next = state.visibleColumns.includes(key)
      ? state.visibleColumns.filter((k) => k !== key)
      : [...state.visibleColumns, key];
    onVisibleColumnsChange(next);
  };

  const toggleFilterValue = (columnKey: string, value: unknown) => {
    const current = state.filters[columnKey] ?? [];
    const next = current.includes(value as any)
      ? current.filter((v) => v !== value)
      : [...current, value];
    
    const nextFilters = { ...state.filters, [columnKey]: next.filter((v) => v != null) };
    if (next.length === 0) {
      delete nextFilters[columnKey];
    }
    onFiltersChange(nextFilters);
  };

  const removeFilterValue = (columnKey: string, value: unknown) => {
    const current = state.filters[columnKey] ?? [];
    const next = current.filter((v) => v !== value);
    const nextFilters = { ...state.filters, [columnKey]: next };
    if (next.length === 0) {
      delete nextFilters[columnKey];
    }
    onFiltersChange(nextFilters);
  };

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
                {columnDefinitions.map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.key}
                    checked={state.visibleColumns.includes(col.key)}
                    onCheckedChange={() => togglePillVisibility(col.key)}
                  >
                    {col.label}
                  </DropdownMenuCheckboxItem>
                ))}
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
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-9", state.sortBy && "rounded-r-none")}>
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">
                      {state.sortBy 
                        ? `${sortOptions.find(o => o.key === state.sortBy)?.label ?? 'Sorted'} (${state.sortDirection})`
                        : 'Sort by'}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
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
                    >
                      {o.label}
                      {state.sortBy === o.key && (
                        <span className="ml-auto text-xs opacity-50">({state.sortDirection})</span>
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
                  <div className="px-2 pb-2 flex flex-wrap gap-1">
                    {Object.entries(state.filters).map(([columnKey, selected]) => {
                      if (!selected?.length) return null;
                      const def = filterDefinitions.find((d) => d.key === columnKey);
                      const label = def?.label ?? columnKey;
                      
                      return (
                        <div key={columnKey} className="flex flex-wrap items-center gap-1 p-1 bg-muted/50 rounded border text-[10px]">
                          <span className="font-semibold">{label} is</span>
                          {selected.map((val, idx) => {
                            const opt = def?.options.find(o => String(o.value) === String(val));
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
                
                <ScrollArea className="flex-1 overflow-y-auto">
                  {filterDefinitions.map((def) => (
                    <DropdownMenuSub key={def.key}>
                      <DropdownMenuSubTrigger>{def.label}</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="w-[200px]">
                        <ScrollArea className="max-h-[300px]">
                          {def.options.map((opt) => {
                            const isSelected = (state.filters[def.key] ?? []).some(v => String(v) === String(opt.value));
                            return (
                              <DropdownMenuCheckboxItem
                                key={String(opt.value)}
                                checked={isSelected}
                                onCheckedChange={() => toggleFilterValue(def.key, opt.value)}
                              >
                                {opt.label}
                              </DropdownMenuCheckboxItem>
                            );
                          })}
                        </ScrollArea>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}
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
