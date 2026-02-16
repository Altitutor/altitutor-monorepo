'use client';

import * as React from 'react';
import { Button } from './button';
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
import { Input } from './input';
import { ScrollArea } from './scroll-area';
import { cn } from '../lib/cn';
import {
  LayoutGrid,
  ArrowUpDown,
  Filter,
  Plus,
  ChevronDown,
  Check,
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
  getValue: (item: TItem) => TValue;
  options: { value: TValue; label: string }[];
  renderBubble: (value: TValue) => React.ReactNode;
  onStatusChange: (item: TItem, value: TValue) => void;
}

export interface EntityListPillColumn<TItem, TValue = unknown> {
  key: string;
  label: string;
  visibleByDefault?: boolean;
  getValue: (item: TItem) => TValue;
  renderPill: (item: TItem, onChange: (value: TValue) => void) => React.ReactNode;
  filterOptions?: { value: TValue; label: string }[];
  groupable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  compare?: (a: TValue, b: TValue) => number;
}

export interface EntityListProps<TItem> {
  items: TItem[];
  getItemId: (item: TItem) => string;
  renderName: (item: TItem) => React.ReactNode;
  leftIcons?: EntityListLeftIcon<TItem>[];
  statusColumn?: EntityListStatusColumn<TItem>;
  rightPills: EntityListPillColumn<TItem, unknown>[];
  groupByOptions?: { key: string; label: string }[];
  sortByOptions?: { key: string; label: string }[];
  onAdd?: (partial: { name: string } & Record<string, unknown>) => void;
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
  /** Resolve group key to display label (e.g. id -> name for assignee) */
  getGroupLabel?: (columnKey: string, valueKey: string) => string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGroupValue<TItem>(
  item: TItem,
  key: string,
  pills: EntityListPillColumn<TItem, unknown>[],
  statusColumn?: EntityListStatusColumn<TItem>
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
    getGroupLabel,
  } = props;

  const [internalVisiblePills, setInternalVisiblePills] = React.useState<string[]>(() =>
    rightPills.filter((p) => p.visibleByDefault !== false).map((p) => p.key)
  );
  const [internalGroupBy, setInternalGroupBy] = React.useState<string | null>(null);
  const [internalSortBy, setInternalSortBy] = React.useState<string>(sortByOptions[0]?.key ?? '');
  const [internalSortDirection, setInternalSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [internalFilters, setInternalFilters] = React.useState<Record<string, unknown[]>>({});
  const [addName, setAddName] = React.useState('');
  const [isAddFocused, setIsAddFocused] = React.useState(false);

  const visiblePillKeys = controlledVisiblePills ?? internalVisiblePills;
  const setVisiblePillKeys = onVisiblePillKeysChange ?? setInternalVisiblePills;
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
  const filters = controlledFilters ?? internalFilters;
  const setFilters = onFiltersChange ?? setInternalFilters;

  const togglePillVisibility = (key: string) => {
    setVisiblePillKeys(
      visiblePillKeys.includes(key) ? visiblePillKeys.filter((k) => k !== key) : [...visiblePillKeys, key]
    );
  };

  const toggleFilter = (columnKey: string, value: unknown) => {
    const current = filters[columnKey] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setFilters({ ...filters, [columnKey]: next.filter(Boolean) });
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
        const match = selected.some((v) => v === value || (typeof v === 'object' && typeof value === 'object' && JSON.stringify(v) === JSON.stringify(value)));
        if (!match) return false;
      }
      return true;
    });
  }, [items, filters, activeFilterCount, rightPills, statusColumn]);

  const sortedItems = React.useMemo(() => {
    const sorted = [...filteredItems];
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
    const entries = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
    return entries.map(([k, groupItems]) => ({
      key: k,
      label: getGroupLabel ? getGroupLabel(groupBy, k) : (k === '__null__' ? 'No value' : k),
      items: groupItems,
    }));
  }, [sortedItems, groupBy, groupByOptions, rightPills, statusColumn, getGroupLabel]);

  const handleAddSubmit = () => {
    const name = addName.trim();
    if (!name || !onAdd) return;
    onAdd({ name });
    setAddName('');
  };

  return (
    <div className="flex flex-col h-full rounded-md border bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-1 p-2 border-b flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <LayoutGrid className="h-4 w-4 mr-2" />
              View options
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuLabel>Show columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {rightPills.map((p) => (
              <DropdownMenuCheckboxItem
                key={p.key}
                checked={visiblePillKeys.includes(p.key)}
                onCheckedChange={() => togglePillVisibility(p.key)}
              >
                {p.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {groupByOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Group by {groupBy ? groupByOptions.find((o) => o.key === groupBy)?.label ?? groupBy : '—'}
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              <DropdownMenuItem onClick={() => setGroupBy(null)}>None</DropdownMenuItem>
              <DropdownMenuSeparator />
              {groupByOptions.map((o) => (
                <DropdownMenuItem key={o.key} onClick={() => setGroupBy(o.key)}>
                  {o.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {sortByOptions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                Sort by {sortByOptions.find((o) => o.key === sortBy)?.label ?? sortBy} ({sortDirection})
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              {sortByOptions.map((o) => (
                <DropdownMenuItem
                  key={o.key}
                  onClick={() => {
                    const nextDirection =
                      sortBy === o.key && sortDirection === 'asc' ? 'desc' : 'asc';
                    setSortBy(o.key, nextDirection);
                  }}
                >
                  {o.label} {sortBy === o.key && <span className="ml-1">({sortDirection})</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter {activeFilterCount > 0 && `(${activeFilterCount})`}
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-w-[320px]">
            <DropdownMenuLabel>Filters (AND between props, OR within)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {activeFilterCount > 0 && (
              <>
                <DropdownMenuItem onClick={clearFilters}>Clear all</DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            {rightPills
              .filter((p) => p.filterable !== false && p.filterOptions?.length)
              .map((p) => (
                <DropdownMenuSub key={p.key}>
                  <DropdownMenuSubTrigger>{p.label}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {p.filterOptions!.map((opt) => {
                      const selected = (filters[p.key] ?? []).includes(opt.value);
                      return (
                        <DropdownMenuCheckboxItem
                          key={String(opt.value)}
                          checked={selected}
                          onCheckedChange={() => toggleFilter(p.key, opt.value)}
                        >
                          {opt.label}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Loading…</div>
          ) : grouped.every((g) => g.items.length === 0) ? (
            <div className="py-8 text-center text-muted-foreground text-sm">{emptyMessage}</div>
          ) : (
            grouped.map((group) => (
              <div key={group.key ?? 'all'} className="mb-4">
                {groupBy && (
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2 py-1.5">
                    {group.label}
                  </div>
                )}
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <EntityListRow
                      key={getItemId(item)}
                      item={item}
                      renderName={renderName}
                      leftIcons={leftIcons}
                      statusColumn={statusColumn}
                      rightPills={rightPills.filter((p) => visiblePillKeys.includes(p.key))}
                      onRowClick={onRowClick}
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Add row */}
      {onAdd && (
        <div
          className={cn(
            'flex items-center gap-2 p-2 border-t flex-shrink-0',
            isAddFocused && 'bg-muted/50'
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label={addButtonLabel}
            onClick={handleAddSubmit}
          >
            <Plus className="h-4 w-4" />
          </Button>
          <Input
            placeholder={`${addButtonLabel}…`}
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddSubmit();
              }
            }}
            onFocus={() => setIsAddFocused(true)}
            onBlur={() => setIsAddFocused(false)}
            className="flex-1 h-8 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
      )}
    </div>
  );
}

interface EntityListRowProps<TItem> {
  item: TItem;
  renderName: (item: TItem) => React.ReactNode;
  leftIcons: EntityListLeftIcon<TItem>[];
  statusColumn?: EntityListStatusColumn<TItem>;
  rightPills: EntityListPillColumn<TItem, unknown>[];
  onRowClick?: (item: TItem) => void;
}

function EntityListRow<TItem>({
  item,
  renderName,
  leftIcons,
  statusColumn,
  rightPills,
  onRowClick,
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
        'flex items-center gap-3 px-2 py-2 rounded-md hover:bg-muted/60 cursor-pointer transition-colors',
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
          <EntityListStatusBubble item={item} column={statusColumn} />
        </div>
      )}

      {/* Name */}
      <div className="flex-1 min-w-0 truncate text-sm font-medium">
        {renderName(item)}
      </div>

      {/* Right: pills */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {rightPills.map((pill) => (
          <div key={pill.key} onClick={(e) => e.stopPropagation()}>
            {pill.renderPill(item, (value) => {
              // Consumer is responsible for updating; we just re-render
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function EntityListStatusBubble<TItem, TValue>({
  item,
  column,
}: {
  item: TItem;
  column: EntityListStatusColumn<TItem, TValue>;
}) {
  const [open, setOpen] = React.useState(false);
  const value = column.getValue(item);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
            'hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {column.renderBubble(value)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {column.options.map((opt) => (
          <DropdownMenuItem
            key={String(opt.value)}
            onClick={() => {
              column.onStatusChange(item, opt.value);
              setOpen(false);
            }}
          >
            {opt.value === value && <Check className="h-4 w-4 mr-2" />}
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
