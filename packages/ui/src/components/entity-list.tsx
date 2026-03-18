'use client';

import * as React from 'react';
import { Button } from './button';
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
import { Input } from './input';
import { ScrollArea } from './scroll-area';
import { SearchableSelect } from './searchable-select';
import { SearchableSelectInline } from './searchable-select-inline';
import { DateRangeFilter } from './date-range-filter';
import { cn } from '../lib/cn';
import { type JSONContent } from './rich-text-editor';
import {
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Plus,
  ChevronDown,
  Check,
  X,
  Layers,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types - generic over item type T
// ---------------------------------------------------------------------------

export interface EntityListLeftIcon<TItem> {
  key: string;
  render: (item: TItem) => React.ReactNode;
}

export interface EntityListStatusColumn<TItem, TValue = string> {
  key: string;
  label: string;
  getValue: (item: TItem) => TValue;
  options: { value: TValue; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  renderBubble: (value: TValue, collapsed?: boolean) => React.ReactNode;
  onStatusChange: (item: TItem, value: TValue) => void;
  defaultValue?: TValue;
  filterable?: boolean;
}

export interface EntityListPillColumn<TItem, TValue = unknown> {
  key: string;
  label: string;
  visibleByDefault?: boolean;
  getValue: (item: TItem) => TValue;
  renderPill: (item: TItem, onChange: (value: TValue) => void, collapsed?: boolean) => React.ReactNode;
  filterOptions?: { value: TValue; label: string }[];
  filterSearchable?: boolean;
  /** When 'date-range', renders DateRangeFilter instead of SearchableSelectInline. Filter stored as [{ type: 'date_range', start, end }] */
  filterType?: 'date-range';
  groupable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  compare?: (a: TValue, b: TValue) => number;
  defaultValue?: TValue;
}

type FilterOption = { value: unknown; label: string };

export interface QuickFilter {
  id: string;
  name: string;
  config: Record<string, unknown[]>;
  user_id: string | null;
  target_entity: string;
  created_at: string;
  updated_at: string;
}

export interface EntityListProps<TItem> {
  items: TItem[];
  getItemId: (item: TItem) => string;
  renderName: (item: TItem) => React.ReactNode;
  leftIcons?: EntityListLeftIcon<TItem>[];
  statusColumn?: EntityListStatusColumn<TItem, unknown>;
  rightPills: EntityListPillColumn<TItem, unknown>[];
  groupByOptions?: { key: string; label: string }[];
  sortByOptions?: { key: string; label: string }[];
  onAdd?: (data: { name: string; description?: string } & Record<string, unknown>) => void;
  onRowClick?: (item: TItem) => void;
  addButtonLabel?: string;
  emptyMessage?: string;
  isLoading?: boolean;
  /** Persist view state in URL or external store; if not provided, state is internal */
  visiblePillKeys?: string[];
  onVisiblePillKeysChange?: (keys: string[]) => void;
  groupBy?: string | null;
  onGroupByChange?: (key: string | null) => void;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (key: string, direction: 'asc' | 'desc') => void;
  filters?: Record<string, unknown[]>;
  onFiltersChange?: (filters: Record<string, unknown[]>) => void;
  quickFilters?: QuickFilter[];
  onApplyQuickFilter?: (filter: QuickFilter) => void;
  /** Resolve group key to display label (e.g. id -> name for assignee) */
  getGroupLabel?: (columnKey: string, valueKey: string) => string;
  /** Custom ordering function for groups. Returns a number for ordering (lower = earlier). If not provided, groups are sorted alphabetically. */
  getGroupOrder?: (columnKey: string, valueKey: string) => number;
  /** Description field configuration */
  descriptionConfig?: {
    enabled: boolean;
    renderEditor: (props: {
      value: JSONContent | string | null;
      onChange: (val: JSONContent) => void;
      placeholder?: string;
      ref?: React.RefObject<unknown>;
    }) => React.ReactNode;
    placeholder?: string;
  };
  hideToolbar?: boolean;
  noPadding?: boolean;
  compact?: boolean;
  /** Add button: 'default' = filled, 'ghost' = transparent (default) */
  addButtonVariant?: 'ghost' | 'default';
  /** When true, show "+ Add" text next to the icon in the add button */
  addButtonShowLabel?: boolean;
  /** Custom add row (e.g. with task-search autocomplete). Receives same props as default add row plus state/refs. */
  renderAddRow?: (props: EntityListAddRowRenderProps<TItem>) => React.ReactNode;
}

export interface EntityListAddRowRenderProps<TItem> {
  onAdd: (data: { name: string; description?: string } & Record<string, unknown>) => void;
  statusColumn?: EntityListStatusColumn<TItem, unknown>;
  rightPills: EntityListPillColumn<TItem, unknown>[];
  visiblePillKeys: string[];
  addButtonLabel: string;
  addButtonVariant?: 'ghost' | 'default';
  addButtonShowLabel?: boolean;
  descriptionConfig?: EntityListProps<TItem>['descriptionConfig'];
  compact: boolean;
  addName: string;
  setAddName: (v: string) => void;
  addDescription: JSONContent | string;
  setAddDescription: (v: JSONContent | string) => void;
  addValues: Record<string, unknown>;
  setAddValues: (v: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => void;
  isDescriptionVisible: boolean;
  setIsDescriptionVisible: (v: boolean) => void;
  handleAddSubmit: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  descriptionRef: React.RefObject<{ focusToEnd?: () => void; getEditor?: () => unknown } | null>;
  isAddFocused: boolean;
  setIsAddFocused: (v: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGroupValue<TItem>(
  item: TItem,
  key: string,
  pills: EntityListPillColumn<TItem, unknown>[],
  statusColumn?: EntityListStatusColumn<TItem, unknown>
): unknown {
  if (statusColumn?.key === key) {
    return statusColumn.getValue(item);
  }
  const col = pills.find((p) => p.key === key);
  return col ? col.getValue(item) : undefined;
}

function compareValues(
  a: unknown,
  b: unknown,
  compareFn?: (a: unknown, b: unknown) => number
): number {
  if (compareFn) return compareFn(a, b);
  if (a === b) return 0;
  if (a == null && b != null) return 1;
  if (a != null && b == null) return -1;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EntityList<TItem>(props: EntityListProps<TItem>) {
  const {
    items,
    getItemId,
    renderName,
    leftIcons = [],
    statusColumn,
    rightPills,
    groupByOptions = [],
    sortByOptions = [],
    onAdd,
    onRowClick,
    addButtonLabel = 'Add',
    emptyMessage = 'No items',
    isLoading = false,
    visiblePillKeys: controlledVisiblePills,
    onVisiblePillKeysChange,
    groupBy: controlledGroupBy,
    onGroupByChange,
    sortBy: controlledSortBy,
    sortDirection: controlledSortDirection,
    onSortChange,
    filters: controlledFilters,
    onFiltersChange,
    quickFilters = [],
    onApplyQuickFilter,
    getGroupLabel,
    getGroupOrder,
    descriptionConfig,
    hideToolbar = false,
    noPadding = false,
    compact = false,
    addButtonVariant,
    addButtonShowLabel = false,
    renderAddRow,
  } = props;

  const [internalVisiblePills, setInternalVisiblePills] = React.useState<string[]>(() =>
    rightPills.filter((p) => p.visibleByDefault !== false).map((p) => p.key)
  );
  const [internalGroupBy, setInternalGroupBy] = React.useState<string | null>(null);
  const [internalSortBy, setInternalSortBy] = React.useState<string>('name');
  const [internalSortDirection, setInternalSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [internalFilters, setInternalFilters] = React.useState<Record<string, unknown[]>>({});
  const [groupByOpen, setGroupByOpen] = React.useState(false);
  const [sortOpen, setSortOpen] = React.useState(false);

  const visiblePillKeys = controlledVisiblePills ?? internalVisiblePills;
  const setVisiblePillKeys = onVisiblePillKeysChange ?? setInternalVisiblePills;

  // Add row state (used when onAdd is set; enables custom renderAddRow with same state)
  const [addName, setAddName] = React.useState('');
  const [addDescription, setAddDescription] = React.useState<JSONContent | string>('');
  const [isDescriptionVisible, setIsDescriptionVisible] = React.useState(false);
  const [addValues, setAddValues] = React.useState<Record<string, unknown>>(() => {
    const defaults: Record<string, unknown> = {};
    if (statusColumn?.defaultValue !== undefined) {
      defaults[statusColumn.key] = statusColumn.defaultValue;
    }
    rightPills.forEach((p) => {
      if (p.defaultValue !== undefined) {
        defaults[p.key] = p.defaultValue;
      }
    });
    return defaults;
  });
  const [isAddFocused, setIsAddFocused] = React.useState(false);
  const addRowInputRef = React.useRef<HTMLInputElement>(null);
  const addRowDescriptionRef = React.useRef<{ focusToEnd?: () => void; getEditor?: () => unknown } | null>(null);

  const handleAddSubmit = React.useCallback(() => {
    if (!onAdd) return;
    const name = addName.trim();
    if (!name) return;
    onAdd({
      name,
      description: addDescription as string,
      ...addValues,
    });
    setAddName('');
    setAddDescription('');
    setIsDescriptionVisible(false);
    const defaults: Record<string, unknown> = {};
    if (statusColumn?.defaultValue !== undefined) {
      defaults[statusColumn.key] = statusColumn.defaultValue;
    }
    rightPills.forEach((p) => {
      if (p.defaultValue !== undefined) {
        defaults[p.key] = p.defaultValue;
      }
    });
    setAddValues(defaults);
    addRowInputRef.current?.focus();
  }, [onAdd, addName, addDescription, addValues, statusColumn, rightPills]);
  const groupBy = controlledGroupBy ?? internalGroupBy;
  const setGroupBy = onGroupByChange ?? setInternalGroupBy;
  const sortBy = controlledSortBy ?? internalSortBy;
  const setSortBy = onSortChange
    ? (k: string, d: 'asc' | 'desc') => onSortChange(k, d)
    : (k: string, d: 'asc' | 'desc') => {
        setInternalSortBy(k);
        setInternalSortDirection(d);
      };
  const sortDirection = controlledSortDirection ?? internalSortDirection;

  // Handle mutual exclusivity between group and sort
  const handleSetGroupBy = (key: string | null) => {
    setGroupBy(key);
    if (key && key === sortBy) {
      setSortBy('name', 'asc');
    }
  };

  const visibleSortByOptions = sortByOptions.filter(o => o.key !== groupBy);
  const filters = controlledFilters ?? internalFilters;
  const setFilters = onFiltersChange ?? setInternalFilters;

  const removeFilterValue = (columnKey: string, value: unknown) => {
    const current = filters[columnKey] ?? [];
    const next = current.filter((v) => v !== value);
    setFilters({ ...filters, [columnKey]: next });
  };

  const clearFilters = () => setFilters({});

  const activeFilterCount = Object.values(filters).reduce((acc, arr) => acc + (arr?.length ?? 0), 0);

  const filteredItems = React.useMemo(() => {
    if (activeFilterCount === 0) return items;
    return items.filter((item) => {
      for (const columnKey of Object.keys(filters)) {
        const selected = filters[columnKey];
        if (!selected?.length) continue;
        const pill = rightPills.find((p) => p.key === columnKey);
        const statusVal = statusColumn?.key === columnKey ? statusColumn.getValue(item) : undefined;
        const value = pill ? pill.getValue(item) : statusVal;
        const hasColumn = pill !== undefined || statusColumn?.key === columnKey;
        if (!hasColumn) continue;
        const match = selected.some((v) => {
          if (v === value) return true;
          
          // Handle date range objects from quick filters
          if (typeof v === 'object' && v !== null && 'type' in v && (v as { type?: string }).type === 'date_range') {
            const dr = v as { start?: string; end?: string; operator?: 'gte' | 'lte' };
            const itemDateStr = typeof value === 'string' ? value : null;
            if (!itemDateStr) return false;
            const itemTime = new Date(itemDateStr).getTime();
            if (isNaN(itemTime)) return false;
            
            if (dr.operator === 'gte' && dr.start) return itemTime >= new Date(dr.start).getTime();
            if (dr.operator === 'lte' && dr.end) return itemTime <= new Date(dr.end).getTime();
            if (dr.start && dr.end) {
              return itemTime >= new Date(dr.start).getTime() && itemTime <= new Date(dr.end).getTime();
            }
            if (dr.start) return itemTime >= new Date(dr.start).getTime();
            if (dr.end) return itemTime <= new Date(dr.end).getTime();
            return false;
          }

          return typeof v === 'object' && typeof value === 'object' && JSON.stringify(v) === JSON.stringify(value);
        });
        if (!match) return false;
      }
      return true;
    });
  }, [items, filters, activeFilterCount, rightPills, statusColumn]);

  const sortedItems = React.useMemo(() => {
    const sorted = [...filteredItems];
    if (sortBy === 'name' || !sortBy) {
      return sorted;
    }
    const pill = rightPills.find((p) => p.key === sortBy);
    const statusCol = statusColumn?.key === sortBy ? statusColumn : undefined;
    const getVal = (item: TItem) =>
      statusCol ? statusCol.getValue(item) : pill ? pill.getValue(item) : undefined;
    const compare = pill?.compare
      ? (a: TItem, b: TItem) => pill.compare!(getVal(a), getVal(b)) as number
      : (a: TItem, b: TItem) => compareValues(getVal(a), getVal(b));
    sorted.sort((a, b) => {
      const cmp = compare(a, b);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredItems, sortBy, sortDirection, rightPills, statusColumn]);

  const grouped = React.useMemo(() => {
    if (!groupBy) {
      return [{ key: null as string | null, label: null, items: sortedItems }];
    }
    const map = new Map<string, TItem[]>();
    for (const item of sortedItems) {
      const val = getGroupValue(item, groupBy, rightPills, statusColumn);
      const k = val == null ? '__null__' : String(val);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(item);
    }
    const entries = Array.from(map.entries()).sort(([a], [b]) => {
      if (getGroupOrder) {
        const orderA = getGroupOrder(groupBy, a);
        const orderB = getGroupOrder(groupBy, b);
        if (orderA !== orderB) return orderA - orderB;
      }
      return a.localeCompare(b);
    });
    return entries.map(([k, groupItems]) => ({
      key: k,
      label: getGroupLabel ? getGroupLabel(groupBy, k) : (k === '__null__' ? 'No value' : k),
      items: groupItems,
    }));
  }, [sortedItems, groupBy, rightPills, statusColumn, getGroupLabel, getGroupOrder]);

  return (
    <div className="flex flex-col h-full rounded-md bg-background overflow-hidden w-full max-w-full">
      {/* Toolbar */}
      {!hideToolbar && (
        <div className="flex flex-wrap items-center gap-1 p-2 border-b flex-shrink-0 w-full overflow-hidden min-w-0">
          {rightPills.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="mr-auto">
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  <span className={cn("hidden md:inline", !visiblePillKeys.length && "opacity-50")}>View options</span>
                  <ChevronDown className="h-4 w-4 ml-1 md:ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[200px] p-0">
                <DropdownMenuLabel className="px-2 py-1.5">Show pills</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <SearchableSelectInline<EntityListPillColumn<TItem, unknown>>
                  items={rightPills}
                  value={rightPills.filter((p) => visiblePillKeys.includes(p.key))}
                  onValueChange={(cols) => setVisiblePillKeys(cols.map((c) => c.key))}
                  getItemId={(p) => p.key}
                  getItemLabel={(p) => p.label}
                  searchPlaceholder="Search columns..."
                  emptyMessage="No columns found"
                  multiSelect
                />
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {groupByOptions.length > 0 && (
            <div className="flex items-center">
              <DropdownMenu open={groupByOpen} onOpenChange={setGroupByOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={cn(groupBy && "rounded-r-none")}>
                    <Layers className="h-4 w-4 mr-2" />
                    <span className={cn("hidden md:inline", !groupBy && "opacity-50")}>
                      Group by {groupBy ? groupByOptions.find((o) => o.key === groupBy)?.label ?? groupBy : ''}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-1 md:ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px] p-0">
                  <DropdownMenuLabel className="px-2 py-1.5">Group by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <SearchableSelectInline<{ key: string; label: string }>
                    items={groupByOptions}
                    value={groupBy ? groupByOptions.find((o) => o.key === groupBy) ?? null : null}
                    onValueChange={(opt) => {
                      handleSetGroupBy(opt?.key ?? null);
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
              {groupBy && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-l-none border-l-0 px-2"
                  onClick={() => handleSetGroupBy(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {sortByOptions.length > 0 && (
            <div className="flex items-center">
              <DropdownMenu open={sortOpen} onOpenChange={setSortOpen}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={cn(sortBy !== 'name' && "rounded-r-none")}>
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <span className={cn("hidden md:inline", sortBy === 'name' && "opacity-50")}>
                      Sort by {sortBy === 'name' ? '' : sortByOptions.find((o) => o.key === sortBy)?.label ?? sortBy}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-1 md:ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px] p-0">
                  <DropdownMenuLabel className="px-2 py-1.5">Sort by</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <SearchableSelectInline<{ key: string; label: string }>
                    items={visibleSortByOptions}
                    value={
                      sortBy === 'name'
                        ? null
                        : visibleSortByOptions.find((o) => o.key === sortBy) ?? null
                    }
                    onValueChange={(opt) => {
                      if (opt) {
                        const nextDir =
                          sortBy === opt.key
                            ? sortDirection === 'asc'
                              ? 'desc'
                              : 'asc'
                            : 'asc';
                        setSortBy(opt.key, nextDir);
                      } else {
                        setSortBy('name', 'asc');
                      }
                      setSortOpen(false);
                    }}
                    getItemId={(o) => o.key}
                    getItemLabel={(o) => o.label}
                    searchPlaceholder="Search sort options..."
                    emptyMessage="No options found"
                    allowClear
                    clearLabel="None (by name)"
                  />
                </DropdownMenuContent>
              </DropdownMenu>
              {sortBy !== 'name' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-none border-l-0 px-2"
                    onClick={() =>
                      setSortBy(sortBy, sortDirection === 'asc' ? 'desc' : 'asc')
                    }
                    aria-label={sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
                  >
                    {sortDirection === 'asc' ? (
                      <ArrowUp className="h-4 w-4" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-l-none border-l-0 px-2"
                    onClick={() => setSortBy('name', 'asc')}
                    aria-label="Clear sort"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          )}

          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn(activeFilterCount > 0 && "rounded-r-none")}>
                  <Filter className="h-4 w-4 mr-2" />
                  <span className={cn("hidden md:inline", activeFilterCount === 0 && "opacity-50")}>
                    Filter {activeFilterCount > 0 && `(${activeFilterCount})`}
                  </span>
                  <ChevronDown className="h-4 w-4 ml-1 md:ml-2" />
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
                          onClick={() => {
                            if (onApplyQuickFilter) {
                              onApplyQuickFilter(qf);
                            } else {
                              setFilters(qf.config);
                            }
                          }}
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
                    {Object.entries(filters).map(([columnKey, selected]) => {
                      if (!selected?.length) return null;
                      const pill = rightPills.find((p) => p.key === columnKey);
                      const statusCol = statusColumn?.key === columnKey ? statusColumn : undefined;
                      const label = pill?.label ?? statusCol?.label ?? columnKey;
                      const isDateRange = pill?.filterType === 'date-range';
                      const dateRangeVal = isDateRange && selected[0] && typeof selected[0] === 'object' && (selected[0] as { type?: string }).type === 'date_range'
                        ? selected[0] as { start?: string; end?: string }
                        : null;

                      return (
                        <div key={columnKey} className="flex flex-wrap items-center gap-1 p-1 bg-muted/50 rounded border text-xs">
                          <span className="font-semibold">{label}:</span>
                          {dateRangeVal ? (
                            <button
                              onClick={() => removeFilterValue(columnKey, selected[0])}
                              className="inline-flex items-center gap-1 px-1 bg-background hover:bg-muted rounded border group"
                            >
                              {dateRangeVal.start && dateRangeVal.end
                                ? `${dateRangeVal.start} – ${dateRangeVal.end}`
                                : dateRangeVal.start
                                  ? `from ${dateRangeVal.start}`
                                  : dateRangeVal.end
                                    ? `to ${dateRangeVal.end}`
                                    : 'set'}
                              <X className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                            </button>
                          ) : (
                            selected.map((val, idx) => {
                              const opt = (pill?.filterOptions ?? statusColumn?.options ?? []).find(o => o.value === val);
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
                            })
                          )}
                        </div>
                      );
                    })}
                    <button
                      onClick={clearFilters}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-muted hover:bg-muted/80 rounded border text-xs font-medium transition-colors"
                    >
                      Clear all
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}

                <DropdownMenuSeparator />
                
                <ScrollArea className="flex-1 overflow-y-auto">
                  {(() => {
                    const renderedKeys = new Set<string>();
                    const filterElements: React.ReactNode[] = [];

                    if (statusColumn && statusColumn.filterable !== false) {
                      renderedKeys.add(statusColumn.key);
                      const options: FilterOption[] = statusColumn.options.map((o) => ({
                        value: o.value,
                        label: o.label,
                      }));
                      const selectedOptions = options.filter((o) =>
                        (filters[statusColumn.key] ?? []).includes(o.value)
                      );
                      filterElements.push(
                        <DropdownMenuSub key={statusColumn.key}>
                          <DropdownMenuSubTrigger>{statusColumn.label}</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-[240px] p-0">
                            <SearchableSelectInline<FilterOption>
                              items={options}
                              value={selectedOptions}
                              onValueChange={(opts) => {
                                const next = opts.map((o) => o.value);
                                if (next.length === 0) {
                                  const rest = Object.fromEntries(
                                    Object.entries(filters).filter(([k]) => k !== statusColumn.key)
                                  );
                                  setFilters(rest);
                                } else {
                                  setFilters({ ...filters, [statusColumn.key]: next });
                                }
                              }}
                              getItemId={(o) => String(o.value)}
                              getItemLabel={(o) => o.label}
                              searchPlaceholder={`Search ${statusColumn.label.toLowerCase()}...`}
                              emptyMessage="No results found"
                              multiSelect
                            />
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      );
                    }

                    rightPills
                      .filter(
                        (p) =>
                          p.filterable !== false &&
                          (p.filterType === 'date-range' || (p.filterOptions?.length ?? 0) > 0)
                      )
                      .forEach((p) => {
                        if (renderedKeys.has(p.key)) return;
                        renderedKeys.add(p.key);

                        if (p.filterType === 'date-range') {
                          const dr = (filters[p.key] ?? [])[0] as
                            | { type: 'date_range'; start?: string; end?: string }
                            | undefined;
                          const fromVal = dr?.start ?? '';
                          const toVal = dr?.end ?? '';
                          filterElements.push(
                            <DropdownMenuSub key={p.key}>
                              <DropdownMenuSubTrigger>{p.label}</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-[260px] p-0">
                                <DateRangeFilter
                                  fromValue={fromVal}
                                  toValue={toVal}
                                  onFromChange={(v) => {
                                    const next =
                                      v || toVal
                                        ? [{ type: 'date_range' as const, start: v || undefined, end: toVal || undefined }]
                                        : [];
                                    if (next.length === 0 && !toVal) {
                                      const rest = Object.fromEntries(
                                        Object.entries(filters).filter(([k]) => k !== p.key)
                                      );
                                      setFilters(rest);
                                    } else {
                                      setFilters({ ...filters, [p.key]: next });
                                    }
                                  }}
                                  onToChange={(v) => {
                                    const next =
                                      fromVal || v
                                        ? [{ type: 'date_range' as const, start: fromVal || undefined, end: v || undefined }]
                                        : [];
                                    if (next.length === 0 && !fromVal) {
                                      const rest = Object.fromEntries(
                                        Object.entries(filters).filter(([k]) => k !== p.key)
                                      );
                                      setFilters(rest);
                                    } else {
                                      setFilters({ ...filters, [p.key]: next });
                                    }
                                  }}
                                  onRangeChange={(from, to) => {
                                    const next =
                                      from || to
                                        ? [{ type: 'date_range' as const, start: from || undefined, end: to || undefined }]
                                        : [];
                                    if (next.length === 0) {
                                      const rest = Object.fromEntries(
                                        Object.entries(filters).filter(([k]) => k !== p.key)
                                      );
                                      setFilters(rest);
                                    } else {
                                      setFilters({ ...filters, [p.key]: next });
                                    }
                                  }}
                                />
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          );
                          return;
                        }

                        const options: FilterOption[] = p.filterOptions!.map((o) => ({
                          value: o.value,
                          label: o.label,
                        }));
                        const selectedOptions = options.filter((o) =>
                          (filters[p.key] ?? []).includes(o.value)
                        );
                        filterElements.push(
                          <DropdownMenuSub key={p.key}>
                            <DropdownMenuSubTrigger>{p.label}</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="w-[240px] p-0">
                              <SearchableSelectInline<FilterOption>
                                items={options}
                                value={selectedOptions}
                                onValueChange={(opts) => {
                                  const next = opts.map((o) => o.value);
                                  if (next.length === 0) {
                                    const rest = Object.fromEntries(
                                      Object.entries(filters).filter(([k]) => k !== p.key)
                                    );
                                    setFilters(rest);
                                  } else {
                                    setFilters({ ...filters, [p.key]: next });
                                  }
                                }}
                                getItemId={(o) => String(o.value)}
                                getItemLabel={(o) => o.label}
                                searchPlaceholder={`Search ${p.label.toLowerCase()}...`}
                                emptyMessage="No results found"
                                multiSelect
                              />
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        );
                      });

                    return filterElements;
                  })()}
                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
            {activeFilterCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-l-none border-l-0 px-2"
                onClick={clearFilters}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <ScrollArea className="flex-1 min-h-0 w-full overflow-x-hidden">
        <div className={cn("pb-0 pt-2 w-full", noPadding ? "px-0" : "px-6")}>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : grouped.every((g) => g.items.length === 0) ? (
            <div className="py-8 text-center text-muted-foreground text-sm">{emptyMessage}</div>
          ) : (
            grouped.map((group) => (
              <div key={group.key ?? 'all'} className="mb-4 w-full">
                {groupBy && (
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2 bg-muted/40 rounded-t-md mb-1 -mx-2">
                    {group.label}
                  </div>
                )}
                <div className="space-y-0.5 w-full">
                  {group.items.map((item) => (
                    <EntityListRow
                      key={getItemId(item)}
                      item={item}
                      renderName={renderName}
                      leftIcons={leftIcons}
                      statusColumn={statusColumn}
                      rightPills={rightPills.filter((p) => visiblePillKeys.includes(p.key))}
                      onRowClick={onRowClick}
                      compact={compact}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Add row */}
      {onAdd && (() => {
        const addRowProps: EntityListAddRowRenderProps<TItem> = {
          onAdd,
          statusColumn,
          rightPills,
          visiblePillKeys,
          addButtonLabel,
          addButtonVariant,
          addButtonShowLabel,
          descriptionConfig,
          compact,
          addName,
          setAddName,
          addDescription,
          setAddDescription,
          addValues,
          setAddValues,
          isDescriptionVisible,
          setIsDescriptionVisible,
          handleAddSubmit,
          inputRef: addRowInputRef,
          descriptionRef: addRowDescriptionRef,
          isAddFocused,
          setIsAddFocused,
        };
        return renderAddRow ? renderAddRow(addRowProps) : <EntityListAddRow {...addRowProps} />;
      })()}
    </div>
  );
}

export function EntityListAddRow<TItem>(props: EntityListAddRowRenderProps<TItem>) {
  const {
    statusColumn,
    rightPills,
    visiblePillKeys,
    addButtonLabel,
    addButtonVariant = 'ghost',
    addButtonShowLabel = false,
    descriptionConfig,
    compact = false,
    addName,
    setAddName,
    addDescription,
    setAddDescription,
    addValues,
    setAddValues,
    isDescriptionVisible,
    setIsDescriptionVisible,
    handleAddSubmit,
    inputRef,
    descriptionRef,
    isAddFocused,
    setIsAddFocused,
  } = props;

  return (
    <div
      className={cn(
        'flex flex-col border-t flex-shrink-0 w-full',
        isAddFocused && 'bg-muted/30'
      )}
    >
      <div className="flex items-center gap-3 p-2 w-full min-w-0 overflow-hidden">
        {statusColumn && (
          <div className="flex-shrink-0">
            <EntityListStatusBubble
              item={addValues as TItem}
              column={{
                ...statusColumn,
                onStatusChange: (_item, val) => setAddValues(prev => ({ ...prev, [statusColumn.key]: val }))
              }}
              compact={compact}
            />
          </div>
        )}

        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          placeholder={`${addButtonLabel}`}
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          onKeyDownCapture={(e) => {
            // Prevent @ from reaching document so mention/entity popups don't open in title (only in body/ProseMirror)
            if (e.key === '@') e.stopPropagation();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (e.shiftKey) {
                if (descriptionConfig?.enabled) {
                  setIsDescriptionVisible(true);
                  setTimeout(() => {
                    descriptionRef?.current?.focusToEnd?.();
                  }, 0);
                }
              } else {
                handleAddSubmit();
              }
            }
          }}
          onFocus={() => setIsAddFocused(true)}
          onBlur={() => setIsAddFocused(false)}
          className="flex-1 h-8 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm font-medium min-w-0 truncate"
        />

        <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {rightPills.filter(p => visiblePillKeys.includes(p.key)).map((pill) => (
            <div key={pill.key} className="flex-shrink-0">
              {compact ? (
                pill.renderPill(addValues as TItem, (val) => setAddValues(prev => ({ ...prev, [pill.key]: val })), true)
              ) : (
                <>
                  {/* Responsive: show full pill on larger screens, icon on smaller */}
                  <div className="hidden lg:block">
                    {pill.renderPill(addValues as TItem, (val) => setAddValues(prev => ({ ...prev, [pill.key]: val })), false)}
                  </div>
                  <div className="lg:hidden">
                    {pill.renderPill(addValues as TItem, (val) => setAddValues(prev => ({ ...prev, [pill.key]: val })), true)}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant={addButtonVariant}
          size="sm"
          className={cn(
            'h-8 flex-shrink-0',
            addButtonShowLabel ? 'gap-1.5 px-2' : 'w-8 p-0',
            addButtonVariant === 'ghost' && 'text-muted-foreground hover:text-foreground'
          )}
          aria-label={addButtonLabel}
          onClick={handleAddSubmit}
        >
          <Plus className="h-4 w-4" />
          {addButtonShowLabel && <span>Add</span>}
        </Button>
      </div>

      {descriptionConfig?.enabled && (isDescriptionVisible || (typeof addDescription === 'string' ? addDescription.trim() !== '' : !!addDescription)) && (
        <div className="px-11 pb-3">
          {descriptionConfig.renderEditor({
            value: addDescription,
            onChange: setAddDescription,
            placeholder: descriptionConfig.placeholder || "Add description...",
            ref: descriptionRef,
          })}
        </div>
      )}
    </div>
  );
}


interface EntityListRowProps<TItem> {
  item: TItem;
  renderName: (item: TItem) => React.ReactNode;
  leftIcons: EntityListLeftIcon<TItem>[];
  statusColumn?: EntityListStatusColumn<TItem, unknown>;
  rightPills: EntityListPillColumn<TItem, unknown>[];
  onRowClick?: (item: TItem) => void;
  compact?: boolean;
}

function EntityListRow<TItem>({
  item,
  renderName,
  leftIcons,
  statusColumn,
  rightPills,
  onRowClick,
  compact = false,
}: EntityListRowProps<TItem>) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onRowClick?.(item)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onRowClick?.(item);
        }
      }}
      className={cn(
        'group flex gap-3 px-2 py-2 rounded-md hover:bg-muted/60 transition-colors w-full min-w-0 overflow-hidden',
        compact ? 'items-start' : 'items-center',
        onRowClick && 'cursor-pointer'
      )}
    >
      {/* Left: icons */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {leftIcons.map((icon) => (
          <div key={icon.key} className="flex items-center justify-center text-muted-foreground">
            {icon.render(item)}
          </div>
        ))}
      </div>

      {/* Status bubble */}
      {statusColumn && (
        <div
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <EntityListStatusBubble item={item} column={statusColumn} compact={compact} />
        </div>
      )}

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-sm font-medium',
            compact ? 'whitespace-normal break-words [overflow-wrap:anywhere]' : 'line-clamp-1'
          )}
        >
          {renderName(item)}
        </div>
      </div>

      {/* Right: pills */}
      <div className="flex items-center gap-2 flex-shrink-0 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {rightPills.map((pill) => {
          return (
            <div
              key={pill.key}
              onClick={(e) => e.stopPropagation()}
              className="transition-opacity flex-shrink-0"
            >
              {compact ? (
                pill.renderPill(item, () => {}, true)
              ) : (
                <>
                  {/* Responsive: show full pill on larger screens, icon on smaller */}
                  <div className="hidden lg:block">
                    {pill.renderPill(item, () => {}, false)}
                  </div>
                  <div className="lg:hidden">
                    {pill.renderPill(item, () => {}, true)}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

type StatusOption<TValue> = {
  value: TValue;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

function EntityListStatusBubble<TItem, TValue>({
  item,
  column,
  compact = false,
}: {
  item: TItem;
  column: EntityListStatusColumn<TItem, TValue>;
  compact?: boolean;
}) {
  const value = column.getValue(item);
  const selectedOption =
    column.options.find((o) => String(o.value) === String(value)) ?? null;

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <SearchableSelect<StatusOption<TValue>>
        items={column.options}
        value={selectedOption}
        onValueChange={(opt) => {
          if (opt) column.onStatusChange(item, opt.value);
        }}
        getItemId={(opt) => String(opt.value)}
        getItemLabel={(opt) => opt.label}
        renderItem={(opt, isSelected) => (
          <>
            <Check
              className={cn(
                'h-4 w-4 flex-shrink-0',
                isSelected ? 'opacity-100' : 'opacity-0'
              )}
            />
            <div className="flex items-center gap-2">
              {opt.icon && <opt.icon className="h-4 w-4" />}
              {opt.label}
            </div>
          </>
        )}
        searchPlaceholder={`Search ${column.label.toLowerCase()}...`}
        align="start"
        trigger={
          <button
            type="button"
            className={cn(
              'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              'hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 bg-background',
            )}
          >
            {compact ? (
              column.renderBubble(value, true)
            ) : (
              <>
                <div className="hidden sm:block">
                  {column.renderBubble(value, false)}
                </div>
                <div className="sm:hidden">
                  {column.renderBubble(value, true)}
                </div>
              </>
            )}
          </button>
        }
      />
    </div>
  );
}
