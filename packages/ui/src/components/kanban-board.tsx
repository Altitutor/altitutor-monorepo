'use client';

import * as React from 'react';
import {
  type CollisionDetection,
  DndContext,
  DragCancelEvent,
  DragEndEvent,
  DragOverlay,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  useDroppable,
} from '@dnd-kit/core';
import {
  type AnimateLayoutChanges,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useVirtualizer } from '@tanstack/react-virtual';
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
import { SearchableSelectInline } from './searchable-select-inline';
import { DateRangeFilter } from './date-range-filter';
import { ToolbarActiveBadge } from './toolbar-active-badge';
import { cn } from '../lib/cn';
import { useRemountPersistentState } from '../hooks/use-remount-persistent-state';
import {
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  Plus,
  X,
  Layers,
  Search,
} from 'lucide-react';
import { EntityListPillColumn, EntityListStatusColumn, QuickFilter, selectedFilterMatchesValue } from './entity-list';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KanbanColumnDef<TItem, TValue = unknown> {
  key: string;
  label: string;
  getValue: (item: TItem) => TValue;
  options: { value: TValue; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  onValueChange: (item: TItem, value: TValue) => void;
  filterable?: boolean;
}

export interface KanbanBoardProps<TItem> {
  items: TItem[];
  getItemId: (item: TItem) => string;
  
  /** Configuration for what defines the kanban columns */
  columnDefs: KanbanColumnDef<TItem, unknown>[];
  activeColumnKey: string;
  onActiveColumnKeyChange?: (key: string) => void;

  renderCard: (item: TItem, visiblePillKeys: string[]) => React.ReactNode;

  // Shared features with EntityList
  statusColumn?: EntityListStatusColumn<TItem, unknown>;
  rightPills: EntityListPillColumn<TItem, unknown>[];
  
  groupByOptions?: { key: string; label: string }[];
  groupBy?: string | null;
  onGroupByChange?: (key: string | null) => void;
  getGroupLabel?: (columnKey: string, valueKey: string) => string;

  sortByOptions?: { key: string; label: string }[];
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (key: string, direction: 'asc' | 'desc') => void;

  filters?: Record<string, unknown[]>;
  onFiltersChange?: (filters: Record<string, unknown[]>) => void;

  hideEmptyColumns?: boolean;
  onHideEmptyColumnsChange?: (hide: boolean) => void;

  visiblePillKeys?: string[];
  onVisiblePillKeysChange?: (keys: string[]) => void;

  quickFilters?: QuickFilter[];
  onApplyQuickFilter?: (filter: QuickFilter) => void;

  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  onAdd?: (columnValue: unknown) => void;
  addButtonLabel?: string;
  isLoading?: boolean;
  emptyMessage?: string;
}

// ---------------------------------------------------------------------------
// Helpers (copied/adapted from EntityList)
// ---------------------------------------------------------------------------

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

function getPropValue<TItem>(
  item: TItem,
  key: string,
  pills: EntityListPillColumn<TItem, unknown>[],
  statusColumn?: EntityListStatusColumn<TItem, unknown>,
  columnDefs?: KanbanColumnDef<TItem>[]
): unknown {
  if (statusColumn?.key === key) {
    return statusColumn.getValue(item);
  }
  const pill = pills.find((p) => p.key === key);
  if (pill) return pill.getValue(item);
  
  const colDef = columnDefs?.find((c) => c.key === key);
  if (colDef) return colDef.getValue(item);
  
  return undefined;
}

type FilterOption = { value: unknown; label: string };

const animateSettlingLayoutChanges: AnimateLayoutChanges = () => true;

const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    const cardCollisions = pointerCollisions.filter(
      (collision) => !String(collision.id).startsWith('column-')
    );
    return cardCollisions.length > 0 ? cardCollisions : pointerCollisions;
  }

  return closestCorners(args);
};

/** Columns larger than this mount only the visible slice plus overscan. */
export const KANBAN_COLUMN_VIRTUALIZE_AFTER = 32;

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function KanbanBoard<TItem>(props: KanbanBoardProps<TItem>) {
  const {
    items,
    getItemId,
    columnDefs,
    activeColumnKey,
    onActiveColumnKeyChange,
    renderCard,
    statusColumn,
    rightPills,
    groupBy: controlledGroupBy,
    getGroupLabel,
    sortByOptions = [],
    sortBy: controlledSortBy,
    sortDirection: controlledSortDirection,
    onSortChange,
    filters: controlledFilters,
    onFiltersChange,
    hideEmptyColumns: controlledHideEmptyColumns,
    visiblePillKeys: controlledVisiblePills,
    onVisiblePillKeysChange,
    quickFilters = [],
    onApplyQuickFilter,
    searchValue,
    onSearchChange,
    searchPlaceholder = 'Search...',
    onAdd,
    addButtonLabel = 'Add',
    isLoading = false,
    emptyMessage = 'No items',
  } = props;

  const [internalGroupBy] = React.useState<string | null>(null);
  const [internalSortBy, setInternalSortBy] = React.useState<string>('name');
  const [internalSortDirection, setInternalSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [internalFilters, setInternalFilters] = React.useState<Record<string, unknown[]>>({});
  const [internalHideEmptyColumns] = React.useState(false);
  const [internalVisiblePills, setInternalVisiblePills] = React.useState<string[]>(() =>
    rightPills.filter((p) => p.filterOnly !== true && p.visibleByDefault !== false).map((p) => p.key)
  );
  const [activeDragItem, setActiveDragItem] = React.useState<TItem | null>(null);
  const [dragPreview, setDragPreview] = React.useState<{
    itemId: string;
    sourceColumnValue: unknown;
    columnValue: unknown;
    index: number;
    dropped: boolean;
  } | null>(null);
  const [settlingColumn, setSettlingColumn] = React.useState<{ value: unknown } | null>(null);
  const settlingTimeoutRef = React.useRef<number | null>(null);
  const [columnSelectOpen, setColumnSelectOpen] = React.useState(false);
  const [sortOpen, setSortOpen] = React.useState(false);
  const filterPersistenceKey = `kanban-board:filters:${typeof window === 'undefined' ? '' : window.location.pathname}`;
  const [filterOpen, setFilterOpen] = useRemountPersistentState(filterPersistenceKey, false);
  const [sortSearchValue, setSortSearchValue] = React.useState('');
  const [localSearchValue, setLocalSearchValue] = React.useState(searchValue ?? '');
  const sortSearchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setLocalSearchValue(searchValue ?? '');
  }, [searchValue]);

  React.useEffect(() => {
    if (!onSearchChange) return;
    const timeout = window.setTimeout(() => {
      if (localSearchValue !== (searchValue ?? '')) {
        onSearchChange(localSearchValue);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [localSearchValue, onSearchChange, searchValue]);

  React.useEffect(() => {
    if (!sortOpen) return;
    requestAnimationFrame(() => sortSearchInputRef.current?.focus());
  }, [sortOpen]);

  const groupBy = controlledGroupBy ?? internalGroupBy;
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
  const hideEmptyColumns = controlledHideEmptyColumns ?? internalHideEmptyColumns;
  const visiblePillKeys = controlledVisiblePills ?? internalVisiblePills;
  const setVisiblePillKeys = onVisiblePillKeysChange ?? setInternalVisiblePills;
  const cardVisiblePillKeys = React.useMemo(() => {
    const hiddenKeys = new Set([activeColumnKey, groupBy].filter(Boolean) as string[]);
    return visiblePillKeys.filter((key) => !hiddenKeys.has(key));
  }, [activeColumnKey, groupBy, visiblePillKeys]);

  const activeColumnDef = columnDefs.find(c => c.key === activeColumnKey) || columnDefs[0];
  const visibleSortByOptions = sortByOptions.filter((o) => o.key !== groupBy);
  const filteredSortByOptions = visibleSortByOptions.filter((option) =>
    option.label.toLowerCase().includes(sortSearchValue.trim().toLowerCase())
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const removeFilterValue = (columnKey: string, value: unknown) => {
    const current = filters[columnKey] ?? [];
    const next = current.filter((v) => v !== value);
    setFilters({ ...filters, [columnKey]: next });
  };

  const clearFilters = () => setFilters({});

  const activeFilterCount = Object.values(filters).reduce((acc, arr) => acc + (arr?.length ?? 0), 0);

  const filteredItems = React.useMemo(() => {
    let result = items;
    if (activeFilterCount > 0) {
      result = result.filter((item) => {
        for (const columnKey of Object.keys(filters)) {
          const selected = filters[columnKey];
          if (!selected?.length) continue;
          
          const value = getPropValue(item, columnKey, rightPills, statusColumn, columnDefs);
          const match = selectedFilterMatchesValue(selected, value);
          if (!match) return false;
        }
        return true;
      });
    }
    return result;
  }, [items, filters, activeFilterCount, rightPills, statusColumn, columnDefs]);

  const sortedItems = React.useMemo(() => {
    const sorted = [...filteredItems];
    if (!sortBy || sortBy === 'name') {
      return sorted;
    }
    const pill = rightPills.find((p) => p.key === sortBy);
    const statusCol = statusColumn?.key === sortBy ? statusColumn : undefined;
    const colDef = columnDefs.find(c => c.key === sortBy);
    
    const getVal = (item: TItem) =>
      statusCol ? statusCol.getValue(item) : pill ? pill.getValue(item) : colDef ? colDef.getValue(item) : undefined;
      
    const compare = pill?.compare
      ? (a: TItem, b: TItem) => pill.compare!(getVal(a), getVal(b)) as number
      : (a: TItem, b: TItem) => compareValues(getVal(a), getVal(b));
      
    sorted.sort((a, b) => {
      const cmp = compare(a, b);
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [filteredItems, sortBy, sortDirection, rightPills, statusColumn, columnDefs]);

  React.useEffect(() => {
    if (!dragPreview?.dropped) return;

    const item = items.find((candidate) => getItemId(candidate) === dragPreview.itemId);
    if (!item) {
      setDragPreview(null);
      return;
    }
    if (
      String(activeColumnDef.getValue(item)) !== String(dragPreview.columnValue)
    ) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      setSettlingColumn({ value: dragPreview.columnValue });
      setDragPreview((current) =>
        current?.dropped && current.itemId === dragPreview.itemId ? null : current
      );
      if (settlingTimeoutRef.current !== null) {
        window.clearTimeout(settlingTimeoutRef.current);
      }
      settlingTimeoutRef.current = window.setTimeout(() => {
        setSettlingColumn(null);
        settlingTimeoutRef.current = null;
      }, 250);
    });

    return () => cancelAnimationFrame(frame);
  }, [activeColumnDef, dragPreview, getItemId, items]);

  React.useEffect(
    () => () => {
      if (settlingTimeoutRef.current !== null) {
        window.clearTimeout(settlingTimeoutRef.current);
      }
    },
    []
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (settlingTimeoutRef.current !== null) {
      window.clearTimeout(settlingTimeoutRef.current);
      settlingTimeoutRef.current = null;
    }
    setSettlingColumn(null);
    setDragPreview(null);
    const item = items.find((t) => getItemId(t) === event.active.id);
    if (item) {
      setActiveDragItem(item);
    }
  };

  const getColumnValueForOverId = (overId: string): unknown => {
    if (overId.startsWith('column-')) {
      const valueStr = overId.replace('column-', '');
      return activeColumnDef.options.find((option) => String(option.value) === valueStr)?.value;
    }

    const targetItem = items.find((item) => getItemId(item) === overId);
    return targetItem ? activeColumnDef.getValue(targetItem) : undefined;
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setDragPreview(null);
      return;
    }

    const itemId = String(active.id);
    const item = items.find((candidate) => getItemId(candidate) === itemId);
    if (!item) return;

    const overId = String(over.id);
    if (overId === itemId && dragPreview?.itemId === itemId) return;

    const sourceColumnValue = activeColumnDef.getValue(item);
    const targetColumnValue = getColumnValueForOverId(overId);

    if (
      targetColumnValue === undefined ||
      String(sourceColumnValue) === String(targetColumnValue)
    ) {
      setDragPreview(null);
      return;
    }

    const targetItems = sortedItems.filter(
      (candidate) =>
        getItemId(candidate) !== itemId &&
        String(activeColumnDef.getValue(candidate)) === String(targetColumnValue)
    );
    let index = targetItems.length;

    if (!overId.startsWith('column-') && overId !== itemId) {
      const overIndex = targetItems.findIndex((candidate) => getItemId(candidate) === overId);
      if (overIndex !== -1) {
        const activatorEvent = event.activatorEvent;
        const pointerY =
          'clientY' in activatorEvent && typeof activatorEvent.clientY === 'number'
            ? activatorEvent.clientY + event.delta.y
            : null;
        const translatedRect = active.rect.current.translated;
        const isBelowOverItem =
          pointerY !== null
            ? pointerY > over.rect.top + over.rect.height / 2
            : translatedRect !== null &&
              translatedRect.top > over.rect.top + over.rect.height / 2;
        index = overIndex + (isBelowOverItem ? 1 : 0);
      }
    }

    setDragPreview((current) => {
      if (
        current?.itemId === itemId &&
        String(current.columnValue) === String(targetColumnValue) &&
        current.index === index &&
        !current.dropped
      ) {
        return current;
      }
      return {
        itemId,
        sourceColumnValue,
        columnValue: targetColumnValue,
        index,
        dropped: false,
      };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);
    const preview = dragPreview;
    const { active, over } = event;
    if (!over) {
      setDragPreview(null);
      return;
    }

    const itemId = active.id as string;
    const overId = String(over.id);
    const newColumnValue =
      overId === itemId && preview
        ? preview.columnValue
        : getColumnValueForOverId(overId);

    if (newColumnValue === undefined) {
      setDragPreview(null);
      return;
    }

    const item = items.find((t) => getItemId(t) === itemId);
    if (!item || activeColumnDef.getValue(item) === newColumnValue) {
      setDragPreview(null);
      return;
    }

    setDragPreview((current) =>
      current &&
      current.itemId === itemId &&
      String(current.columnValue) === String(newColumnValue)
        ? { ...current, dropped: true }
        : current
    );

    activeColumnDef.onValueChange(item, newColumnValue);
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    setActiveDragItem(null);
    setDragPreview(null);
  };

  return (
    <div className="flex h-full w-full max-w-full flex-col overflow-hidden rounded-[var(--radius)] bg-background">
      {/* Toolbar */}
      <div className="flex w-full min-w-0 flex-shrink-0 flex-wrap items-center gap-2 overflow-hidden border-b p-2">
        {onSearchChange ? (
          <div className="flex h-10 min-w-[220px] flex-1 items-center rounded-md border border-input bg-background px-2 ring-offset-background transition-colors focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Search className="h-3.5 w-3.5" />
            </span>
            <Input
              placeholder={searchPlaceholder}
              value={localSearchValue}
              onChange={(event) => setLocalSearchValue(event.target.value)}
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {localSearchValue ? (
              <button
                type="button"
                onClick={() => setLocalSearchValue('')}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="size-9 p-0 md:h-10 md:w-auto md:px-3">
                <LayoutGrid className="h-4 w-4 md:mr-2" />
                <span className={cn("hidden md:inline", !visiblePillKeys.length && "opacity-50")}>View</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px] p-0">
              <DropdownMenuLabel className="px-2 py-1.5">Show pills</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <SearchableSelectInline<EntityListPillColumn<TItem, unknown>>
                items={rightPills.filter((p) => p.filterOnly !== true)}
                value={rightPills.filter((p) => p.filterOnly !== true && visiblePillKeys.includes(p.key))}
                onValueChange={(cols) => setVisiblePillKeys(cols.map((c) => c.key))}
                getItemId={(p) => p.key}
                getItemLabel={(p) => p.label}
                searchPlaceholder="Search pills..."
                emptyMessage="No pills found"
                multiSelect
              />
            </DropdownMenuContent>
          </DropdownMenu>

          {columnDefs.length > 1 && (
            <div className="relative flex items-center">
              <DropdownMenu open={columnSelectOpen} onOpenChange={setColumnSelectOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="size-9 p-0 md:h-10 md:w-auto md:px-3">
                  <Layers className="h-4 w-4 md:mr-2" />
                  <span className="hidden md:inline">Group by {activeColumnDef.label}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px] p-0">
                <DropdownMenuLabel className="px-2 py-1.5">Group by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <SearchableSelectInline<KanbanColumnDef<TItem>>
                  items={columnDefs}
                  value={activeColumnDef}
                  onValueChange={(col) => {
                    if (col) {
                      onActiveColumnKeyChange?.(col.key);
                      setColumnSelectOpen(false);
                    }
                  }}
                  getItemId={(c) => c.key}
                  getItemLabel={(c) => c.label}
                  searchPlaceholder="Search..."
                  emptyMessage="No options found"
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {sortByOptions.length > 0 && (
          <div className="relative flex items-center">
            <DropdownMenu open={sortOpen} onOpenChange={setSortOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="size-9 p-0 sm:h-10 sm:w-auto sm:px-3">
                  <ArrowUpDown className="h-4 w-4 sm:mr-2" />
                  <span className={cn("hidden sm:inline", sortBy === 'name' && "opacity-50")}>
                    Sort by {sortBy === 'name' ? '' : sortByOptions.find((o) => o.key === sortBy)?.label ?? sortBy}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[240px]">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <div className="flex items-center border-b px-3">
                  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                  <Input
                    ref={sortSearchInputRef}
                    value={sortSearchValue}
                    onChange={(event) => setSortSearchValue(event.target.value)}
                    placeholder="Search sort options..."
                    className="flex h-11 w-full rounded-md border-0 bg-transparent px-0 py-3 text-sm shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0"
                  />
                </div>
                <DropdownMenuItem
                  onSelect={() => {
                    setSortBy('name', 'asc');
                    setSortOpen(false);
                  }}
                >
                  None (by name)
                </DropdownMenuItem>
                {filteredSortByOptions.map((option) => {
                  const selected = sortBy === option.key;
                  return (
                    <DropdownMenuItem
                      key={option.key}
                      className="flex items-center gap-2"
                      onSelect={(event) => {
                        if (selected) {
                          event.preventDefault();
                          return;
                        }
                        setSortBy(option.key, 'asc');
                        setSortOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {selected ? (
                        <button
                          type="button"
                          className="inline-flex h-7 items-center gap-1 rounded-[var(--radius)] border bg-background px-2 text-xs hover:bg-muted"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setSortBy(option.key, sortDirection === 'asc' ? 'desc' : 'asc');
                          }}
                          aria-label={sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
                        >
                          {sortDirection === 'asc' ? (
                            <ArrowUp className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5" />
                          )}
                          {sortDirection === 'asc' ? 'Asc' : 'Desc'}
                        </button>
                      ) : null}
                    </DropdownMenuItem>
                  );
                })}
                {sortBy !== 'name' ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => {
                        setSortBy('name', 'asc');
                        setSortOpen(false);
                      }}
                    >
                      Clear sort
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            {sortBy !== 'name' ? (
              <ToolbarActiveBadge onClear={() => setSortBy('name', 'asc')} ariaLabel="Clear sort">
                {sortDirection === 'asc' ? (
                  <ArrowUp className="h-3 w-3" />
                ) : (
                  <ArrowDown className="h-3 w-3" />
                )}
              </ToolbarActiveBadge>
            ) : null}
          </div>
        )}

        <div className="relative flex items-center">
          <DropdownMenu open={filterOpen} onOpenChange={setFilterOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="size-9 p-0 md:h-10 md:w-auto md:px-3">
                <Filter className="h-4 w-4 md:mr-2" />
                <span className={cn("hidden md:inline", activeFilterCount === 0 && "opacity-50")}>
                  Filter
                </span>
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
                    {Object.entries(filters).map(([columnKey, selected]: [string, unknown[]]) => {
                      if (!selected?.length) return null;
                      const pill = rightPills.find((p) => p.key === columnKey);
                      const statusCol = statusColumn?.key === columnKey ? statusColumn : undefined;
                      const colDef = columnDefs.find(c => c.key === columnKey);
                      const label = pill?.label ?? statusCol?.label ?? colDef?.label ?? columnKey;
                      const isDateRange = pill?.filterType === 'date-range';
                      const dateRangeVal =
                        isDateRange &&
                        selected[0] &&
                        typeof selected[0] === 'object' &&
                        (selected[0] as { type?: string }).type === 'date_range'
                          ? (selected[0] as { start?: string; end?: string })
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
                              const options =
                                pill?.filterOptions ?? statusColumn?.options ?? colDef?.options ?? [];
                              const opt = options.find(
                                (o: { value: unknown; label: string }) => String(o.value) === String(val)
                              );
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

                    columnDefs.forEach((col: KanbanColumnDef<TItem>) => {
                      if (col.filterable === false) return;
                      if (renderedKeys.has(col.key)) return;
                      renderedKeys.add(col.key);
                      const options: FilterOption[] = col.options.map((o) => ({
                        value: o.value,
                        label: o.label,
                      }));
                      const selectedOptions = options.filter((o) =>
                        (filters[col.key] ?? []).includes(o.value)
                      );
                      filterElements.push(
                        <DropdownMenuSub key={col.key}>
                          <DropdownMenuSubTrigger>{col.label}</DropdownMenuSubTrigger>
                          <DropdownMenuSubContent className="w-[240px] p-0">
                            <SearchableSelectInline<FilterOption>
                              items={options}
                              value={selectedOptions}
                              onValueChange={(opts) => {
                                const next = opts.map((o) => o.value);
                                if (next.length === 0) {
                                  const rest = Object.fromEntries(
                                    Object.entries(filters).filter(([k]) => k !== col.key)
                                  );
                                  setFilters(rest);
                                } else {
                                  setFilters({ ...filters, [col.key]: next });
                                }
                              }}
                              getItemId={(o) => String(o.value)}
                              getItemLabel={(o) => o.label}
                              searchPlaceholder={`Search ${col.label.toLowerCase()}...`}
                              emptyMessage="No results found"
                              multiSelect
                            />
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      );
                    });

                    rightPills
                      .filter(
                        (p: EntityListPillColumn<TItem, unknown>) =>
                          p.filterable !== false &&
                          (p.filterType === 'date-range' || (p.filterOptions?.length ?? 0) > 0)
                      )
                      .forEach((p: EntityListPillColumn<TItem, unknown>) => {
                        if (renderedKeys.has(p.key)) return;
                        renderedKeys.add(p.key);

                        if (p.filterType === 'date-range') {
                          const dr = (filters[p.key] ?? [])[0] as
                            | { type: 'date_range'; start?: string; end?: string }
                            | undefined;
                          const fromVal = dr?.start ?? '';
                          const toVal = dr?.end ?? '';
                          filterElements.push(
                            <DropdownMenuSub
                              key={p.key}
                              persistOpenOnRemountKey={`${filterPersistenceKey}:date:${p.key}`}
                            >
                              <DropdownMenuSubTrigger>{p.label}</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-[260px] p-0">
                                <DateRangeFilter
                                  fromValue={fromVal}
                                  toValue={toVal}
                                  onFromChange={(v) => {
                                    const next =
                                      v || toVal
                                        ? [
                                            {
                                              type: 'date_range' as const,
                                              start: v || undefined,
                                              end: toVal || undefined,
                                            },
                                          ]
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
                                        ? [
                                            {
                                              type: 'date_range' as const,
                                              start: fromVal || undefined,
                                              end: v || undefined,
                                            },
                                          ]
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
                                        ? [
                                            {
                                              type: 'date_range' as const,
                                              start: from || undefined,
                                              end: to || undefined,
                                            },
                                          ]
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
            {activeFilterCount > 0 ? (
              <ToolbarActiveBadge onClear={clearFilters} ariaLabel="Clear all filters">
                {activeFilterCount}
              </ToolbarActiveBadge>
            ) : null}
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 min-h-0 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        )}
        
        <DndContext
          sensors={sensors}
          collisionDetection={kanbanCollisionDetection}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="h-full w-full overflow-x-auto overflow-y-hidden">
            <div className="flex h-full px-6 pb-0 pt-2 gap-4 min-w-max">
              {activeColumnDef.options.map((option: { value: unknown; label: string }) => {
                const persistedColumnItems = sortedItems.filter(
                  (item) => String(activeColumnDef.getValue(item)) === String(option.value)
                );
                let columnItems = persistedColumnItems;

                const previewItem = dragPreview
                  ? items.find((item) => getItemId(item) === dragPreview.itemId)
                  : null;

                if (dragPreview && previewItem) {
                  const isSourceColumn =
                    String(dragPreview.sourceColumnValue) === String(option.value);
                  const isTargetColumn =
                    String(dragPreview.columnValue) === String(option.value);

                  if (isSourceColumn) {
                    columnItems = columnItems.filter(
                      (item) => getItemId(item) !== dragPreview.itemId
                    );
                  } else if (isTargetColumn) {
                    columnItems = columnItems.filter(
                      (item) => getItemId(item) !== dragPreview.itemId
                    );
                    columnItems.splice(dragPreview.index, 0, previewItem);
                  }
                }
                
                if (hideEmptyColumns && persistedColumnItems.length === 0) return null;

                return (
                  <KanbanColumn
                    key={String(option.value)}
                    id={`column-${option.value}`}
                    label={option.label}
                    items={columnItems}
                    getItemId={getItemId}
                    renderCard={renderCard}
                    onAdd={onAdd ? () => onAdd(option.value) : undefined}
                    addButtonLabel={addButtonLabel}
                    groupBy={groupBy}
                    getGroupLabel={getGroupLabel}
                    statusColumn={statusColumn}
                    rightPills={rightPills.filter(p => cardVisiblePillKeys.includes(p.key))}
                    columnDefs={columnDefs}
                    visiblePillKeys={cardVisiblePillKeys}
                    emptyMessage={emptyMessage}
                    animateLayoutChanges={
                      settlingColumn !== null &&
                      String(settlingColumn.value) === String(option.value)
                    }
                  />
                );
              })}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDragItem ? (
              <div className="opacity-50 rotate-3 scale-105 pointer-events-none">
                {renderCard(activeDragItem, cardVisiblePillKeys)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column Component
// ---------------------------------------------------------------------------

interface KanbanColumnProps<TItem> {
  id: string;
  label: string;
  items: TItem[];
  getItemId: (item: TItem) => string;
  renderCard: (item: TItem, visiblePillKeys: string[]) => React.ReactNode;
  onAdd?: () => void;
  addButtonLabel: string;
  groupBy: string | null;
  getGroupLabel?: (columnKey: string, valueKey: string) => string;
  statusColumn?: EntityListStatusColumn<TItem, unknown>;
  rightPills: EntityListPillColumn<TItem, unknown>[];
  columnDefs: KanbanColumnDef<TItem, unknown>[];
  visiblePillKeys: string[];
  emptyMessage: string;
  animateLayoutChanges: boolean;
}

function KanbanColumn<TItem>({
  id,
  label,
  items,
  getItemId,
  renderCard,
  onAdd,
  addButtonLabel,
  groupBy,
  getGroupLabel,
  statusColumn,
  rightPills,
  columnDefs,
  visiblePillKeys,
  emptyMessage,
  animateLayoutChanges,
}: KanbanColumnProps<TItem>) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const [viewportHeight, setViewportHeight] = React.useState(0);

  React.useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const update = () => setViewportHeight(element.clientHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const grouped = React.useMemo(() => {
    if (!groupBy) {
      return [{ key: null, label: null, items }];
    }
    const map = new Map<string, TItem[]>();
    for (const item of items) {
      const val = getPropValue(item, groupBy, rightPills, statusColumn, columnDefs);
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
  }, [items, groupBy, rightPills, statusColumn, columnDefs, getGroupLabel]);

  const ungroupedItems = grouped.length === 1 && grouped[0].key === null ? grouped[0].items : null;
  const virtualize =
    ungroupedItems != null
    && viewportHeight > 0
    && ungroupedItems.length > KANBAN_COLUMN_VIRTUALIZE_AFTER;
  const windowedItems =
    ungroupedItems != null
    && viewportHeight === 0
    && ungroupedItems.length > KANBAN_COLUMN_VIRTUALIZE_AFTER
      ? ungroupedItems.slice(0, KANBAN_COLUMN_VIRTUALIZE_AFTER)
      : ungroupedItems;

  const virtualizer = useVirtualizer({
    count: virtualize && ungroupedItems ? ungroupedItems.length : 0,
    getScrollElement: () => viewportRef.current,
    estimateSize: () => 108,
    overscan: 8,
    getItemKey: (index) => (ungroupedItems ? getItemId(ungroupedItems[index]) : index),
  });

  const renderedUngroupedItems = virtualize && ungroupedItems
    ? virtualizer.getVirtualItems().map((row) => ({
        item: ungroupedItems[row.index],
        start: row.start,
        key: row.key,
        measureRef: virtualizer.measureElement,
        index: row.index,
      }))
    : (windowedItems ?? []).map((item, index) => ({
        item,
        start: null as number | null,
        key: getItemId(item),
        measureRef: undefined as ((node: Element | null) => void) | undefined,
        index,
      }));

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex h-full w-[300px] min-w-[300px] flex-col rounded-[var(--radius)] bg-muted/30 transition-colors',
        isOver && 'bg-muted/50'
      )}
    >
      <div className="flex items-center justify-between p-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{label}</h3>
          <span className="text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded border">
            {items.length}
          </span>
        </div>
        {onAdd && (
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onAdd} title={addButtonLabel}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1" viewportRef={viewportRef}>
        {ungroupedItems ? (
          <SortableContext items={ungroupedItems.map(getItemId)} strategy={verticalListSortingStrategy}>
            <div
              className="p-2 pt-0"
              style={virtualize ? { height: virtualizer.getTotalSize(), position: 'relative' } : undefined}
            >
              {renderedUngroupedItems.map((row) => (
                <div
                  key={String(row.key)}
                  data-index={row.index}
                  ref={row.measureRef}
                  className={virtualize ? 'absolute left-0 right-0 px-0 pb-2' : 'pb-2'}
                  style={
                    virtualize && row.start != null
                      ? { transform: `translateY(${row.start}px)` }
                      : undefined
                  }
                >
                  <SortableCard
                    item={row.item}
                    getItemId={getItemId}
                    renderCard={renderCard}
                    visiblePillKeys={visiblePillKeys}
                    animateLayoutChanges={animateLayoutChanges}
                  />
                </div>
              ))}
              {items.length === 0 && (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  {emptyMessage}
                </div>
              )}
            </div>
          </SortableContext>
        ) : (
          <div className="p-2 pt-0 space-y-4">
            {grouped.map((group: { key: string | null; label: string | null; items: TItem[] }) => (
              <div key={group.key ?? 'all'} className="space-y-2">
                {group.label && (
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                    {group.label}
                  </div>
                )}
                <SortableContext items={group.items.map(getItemId)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {group.items.map((item: TItem) => (
                      <SortableCard
                        key={getItemId(item)}
                        item={item}
                        getItemId={getItemId}
                        renderCard={renderCard}
                        visiblePillKeys={visiblePillKeys}
                        animateLayoutChanges={animateLayoutChanges}
                      />
                    ))}
                  </div>
                </SortableContext>
              </div>
            ))}
            {items.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card Component
// ---------------------------------------------------------------------------

interface SortableCardProps<TItem> {
  item: TItem;
  getItemId: (item: TItem) => string;
  renderCard: (item: TItem, visiblePillKeys: string[]) => React.ReactNode;
  visiblePillKeys: string[];
  animateLayoutChanges: boolean;
}

function SortableCard<TItem>({
  item,
  getItemId,
  renderCard,
  visiblePillKeys,
  animateLayoutChanges,
}: SortableCardProps<TItem>) {
  const id = getItemId(item);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    animateLayoutChanges: animateLayoutChanges
      ? animateSettlingLayoutChanges
      : undefined,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-[var(--radius)] transition-colors hover:bg-muted/40',
        isDragging && 'opacity-30'
      )}
      {...attributes}
      {...listeners}
    >
      {renderCard(item, visiblePillKeys)}
    </div>
  );
}
