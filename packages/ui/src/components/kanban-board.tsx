'use client';

import * as React from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { ScrollArea, ScrollBar } from './scroll-area';
import { cn } from '../lib/cn';
import {
  LayoutGrid,
  ArrowUpDown,
  Filter,
  Plus,
  ChevronDown,
  X,
  Columns,
} from 'lucide-react';
import { EntityListPillColumn, EntityListStatusColumn } from './entity-list';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KanbanColumnDef<TItem, TValue = any> {
  key: string;
  label: string;
  getValue: (item: TItem) => TValue;
  options: { value: TValue; label: string; icon?: React.ComponentType<{ className?: string }> }[];
  onValueChange: (item: TItem, value: TValue) => void;
}

export interface KanbanBoardProps<TItem> {
  items: TItem[];
  getItemId: (item: TItem) => string;
  
  /** Configuration for what defines the kanban columns */
  columnDefs: KanbanColumnDef<TItem, any>[];
  activeColumnKey: string;
  onActiveColumnKeyChange?: (key: string) => void;

  renderCard: (item: TItem, visiblePillKeys: string[]) => React.ReactNode;

  // Shared features with EntityList
  statusColumn?: EntityListStatusColumn<TItem, any>;
  rightPills: EntityListPillColumn<TItem, any>[];
  
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

  onAdd?: (columnValue: any) => void;
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
  statusColumn?: EntityListStatusColumn<TItem>,
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
    groupByOptions = [],
    groupBy: controlledGroupBy,
    onGroupByChange,
    getGroupLabel,
    sortByOptions = [],
    sortBy: controlledSortBy,
    sortDirection: controlledSortDirection,
    onSortChange,
    filters: controlledFilters,
    onFiltersChange,
    hideEmptyColumns: controlledHideEmptyColumns,
    onHideEmptyColumnsChange,
    visiblePillKeys: controlledVisiblePills,
    onVisiblePillKeysChange,
    onAdd,
    addButtonLabel = 'Add',
    isLoading = false,
    emptyMessage = 'No items',
  } = props;

  const [internalGroupBy, setInternalGroupBy] = React.useState<string | null>(null);
  const [internalSortBy, setInternalSortBy] = React.useState<string>('name');
  const [internalSortDirection, setInternalSortDirection] = React.useState<'asc' | 'desc'>('asc');
  const [internalFilters, setInternalFilters] = React.useState<Record<string, unknown[]>>({});
  const [internalHideEmptyColumns, setInternalHideEmptyColumns] = React.useState(false);
  const [internalVisiblePills, setInternalVisiblePills] = React.useState<string[]>(() =>
    rightPills.filter((p) => p.visibleByDefault !== false).map((p) => p.key)
  );
  const [activeDragItem, setActiveDragItem] = React.useState<TItem | null>(null);

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
  const hideEmptyColumns = controlledHideEmptyColumns ?? internalHideEmptyColumns;
  const setHideEmptyColumns = onHideEmptyColumnsChange ?? setInternalHideEmptyColumns;
  const visiblePillKeys = controlledVisiblePills ?? internalVisiblePills;
  const setVisiblePillKeys = onVisiblePillKeysChange ?? setInternalVisiblePills;

  const activeColumnDef = columnDefs.find(c => c.key === activeColumnKey) || columnDefs[0];

  const togglePillVisibility = (key: string) => {
    setVisiblePillKeys(
      visiblePillKeys.includes(key) ? visiblePillKeys.filter((k) => k !== key) : [...visiblePillKeys, key]
    );
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const toggleFilter = (columnKey: string, value: unknown) => {
    const current = filters[columnKey] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setFilters({ ...filters, [columnKey]: next.filter((v) => v != null) });
  };

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
          const match = selected.some((v) => 
            v === value || 
            (typeof v === 'object' && typeof value === 'object' && JSON.stringify(v) === JSON.stringify(value))
          );
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

  const handleDragStart = (event: DragStartEvent) => {
    const item = items.find((t) => getItemId(t) === event.active.id);
    if (item) {
      setActiveDragItem(item);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over) return;

    const itemId = active.id as string;
    let newColumnValue: any;

    // Check if over a column or over another card
    const overId = String(over.id);
    if (overId.startsWith('column-')) {
      const valueStr = overId.replace('column-', '');
      // Find the option with this value
      const option = activeColumnDef.options.find(opt => String(opt.value) === valueStr);
      if (option) newColumnValue = option.value;
    } else {
      // Over another card, find that card's column value
      const targetItem = items.find(t => getItemId(t) === overId);
      if (targetItem) {
        newColumnValue = activeColumnDef.getValue(targetItem);
      }
    }

    if (newColumnValue === undefined) return;

    const item = items.find((t) => getItemId(t) === itemId);
    if (!item || activeColumnDef.getValue(item) === newColumnValue) return;

    activeColumnDef.onValueChange(item, newColumnValue);
  };

  return (
    <div className="flex flex-col h-full rounded-md border bg-background overflow-hidden w-full max-w-full">
      {/* Toolbar */}
      <ScrollArea className="w-full border-b">
        <div className="flex items-center justify-end gap-1 p-2 flex-shrink-0 min-w-max">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="mr-1">
                <LayoutGrid className="h-4 w-4 mr-2" />
                <span className={cn(!visiblePillKeys.length && "opacity-50")}>View options</span>
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>Show pills</DropdownMenuLabel>
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

          {columnDefs.length > 1 && (
            <div className="flex items-center mr-auto">
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Columns className="h-4 w-4 mr-2" />
                    <span>Columns: {activeColumnDef.label}</span>
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[180px]">
                  {columnDefs.map((o: KanbanColumnDef<TItem>) => (
                    <DropdownMenuItem key={o.key} onClick={() => onActiveColumnKeyChange?.(o.key)}>
                      {o.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {groupByOptions.length > 0 && (
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={cn(groupBy && "rounded-r-none")}>
                    <span className={cn(!groupBy && "opacity-50")}>
                      Group by {groupBy ? groupByOptions.find((o) => o.key === groupBy)?.label ?? groupBy : ''}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                  <DropdownMenuItem onClick={() => setGroupBy(null)}>None</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {groupByOptions.map((o: { key: string; label: string }) => (
                    <DropdownMenuItem key={o.key} onClick={() => setGroupBy(o.key)}>
                      {o.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {groupBy && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-l-none border-l-0 px-2"
                  onClick={() => setGroupBy(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {sortByOptions.length > 0 && (
            <div className="flex items-center">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className={cn(sortBy !== 'name' && "rounded-r-none")}>
                    <ArrowUpDown className="h-4 w-4 mr-2" />
                    <span className={cn(sortBy === 'name' && "opacity-50")}>
                      Sort by {sortBy === 'name' ? '' : sortByOptions.find((o) => o.key === sortBy)?.label ?? sortBy} {sortBy !== 'name' && `(${sortDirection})`}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuItem onClick={() => setSortBy('name', 'asc')}>None (by name)</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {sortByOptions.map((o: { key: string; label: string }) => (
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
              {sortBy !== 'name' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-l-none border-l-0 px-2"
                  onClick={() => {
                    setSortBy('name', 'asc');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          <div className="flex items-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={cn(activeFilterCount > 0 && "rounded-r-none")}>
                  <Filter className="h-4 w-4 mr-2" />
                  <span className={cn(activeFilterCount === 0 && "opacity-50")}>
                    Filter {activeFilterCount > 0 && `(${activeFilterCount})`}
                  </span>
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[320px] max-h-[500px] overflow-hidden flex flex-col">
                <DropdownMenuLabel>Filters</DropdownMenuLabel>
                
                <div className="px-2 py-1.5">
                  <DropdownMenuCheckboxItem
                    checked={hideEmptyColumns}
                    onCheckedChange={setHideEmptyColumns}
                  >
                    Hide empty columns
                  </DropdownMenuCheckboxItem>
                </div>

                <DropdownMenuSeparator />
                
                {activeFilterCount > 0 && (
                  <div className="px-2 pb-2 flex flex-wrap gap-1">
                    {Object.entries(filters).map(([columnKey, selected]: [string, unknown[]]) => {
                      if (!selected?.length) return null;
                      const pill = rightPills.find((p) => p.key === columnKey);
                      const statusCol = statusColumn?.key === columnKey ? statusColumn : undefined;
                      const colDef = columnDefs.find(c => c.key === columnKey);
                      const label = pill?.label ?? statusCol?.label ?? colDef?.label ?? columnKey;
                      
                      return (
                        <div key={columnKey} className="flex flex-wrap items-center gap-1 p-1 bg-muted/50 rounded border text-xs">
                          <span className="font-semibold">{label} is</span>
                          {selected.map((val, idx) => {
                            const options = pill?.filterOptions ?? statusColumn?.options ?? colDef?.options ?? [];
                            const opt = options.find((o: any) => String(o.value) === String(val));
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
                  {statusColumn && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Status</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {statusColumn.options.map((opt: { value: any; label: string }) => {
                          const selected = (filters[statusColumn.key] ?? []).includes(opt.value);
                          return (
                            <DropdownMenuCheckboxItem
                              key={String(opt.value)}
                              checked={selected}
                              onCheckedChange={() => toggleFilter(statusColumn.key, opt.value)}
                            >
                              {opt.label}
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  {columnDefs.map((col: KanbanColumnDef<TItem>) => (
                     <DropdownMenuSub key={col.key}>
                      <DropdownMenuSubTrigger>{col.label}</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {col.options.map((opt: { value: any; label: string }) => {
                          const selected = (filters[col.key] ?? []).includes(opt.value);
                          return (
                            <DropdownMenuCheckboxItem
                              key={String(opt.value)}
                              checked={selected}
                              onCheckedChange={() => toggleFilter(col.key, opt.value)}
                            >
                              {opt.label}
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  ))}
                  {rightPills
                    .filter((p: EntityListPillColumn<TItem, any>) => p.filterable !== false && p.filterOptions?.length)
                    .map((p: EntityListPillColumn<TItem, any>) => (
                      <DropdownMenuSub key={p.key}>
                        <DropdownMenuSubTrigger>{p.label}</DropdownMenuSubTrigger>
                        <DropdownMenuSubContent>
                          {p.filterOptions!.map((opt: { value: any; label: string }) => {
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
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Board */}
      <div className="flex-1 min-h-0 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        )}
        
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="h-full w-full overflow-x-auto overflow-y-hidden">
            <div className="flex h-full p-4 gap-4 min-w-max">
              {activeColumnDef.options.map((option: { value: any; label: string }) => {
                const columnItems = sortedItems.filter(
                  (item) => String(activeColumnDef.getValue(item)) === String(option.value)
                );
                
                if (hideEmptyColumns && columnItems.length === 0) return null;

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
                    rightPills={rightPills.filter(p => visiblePillKeys.includes(p.key))}
                    visiblePillKeys={visiblePillKeys}
                  />
                );
              })}
            </div>
          </div>

          <DragOverlay>
            {activeDragItem ? (
              <div className="opacity-50 rotate-3 scale-105 pointer-events-none">
                {renderCard(activeDragItem, visiblePillKeys)}
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
  statusColumn?: EntityListStatusColumn<TItem, any>;
  rightPills: EntityListPillColumn<TItem, any>[];
  visiblePillKeys: string[];
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
  visiblePillKeys,
}: KanbanColumnProps<TItem>) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const grouped = React.useMemo(() => {
    if (!groupBy) {
      return [{ key: null, label: null, items }];
    }
    const map = new Map<string, TItem[]>();
    for (const item of items) {
      const val = getPropValue(item, groupBy, rightPills, statusColumn);
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
  }, [items, groupBy, rightPills, statusColumn, getGroupLabel]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col h-full w-[300px] min-w-[300px] rounded-lg bg-muted/30 transition-colors',
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
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onAdd} title={addButtonLabel}>
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
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
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          ))}
          {items.length === 0 && (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No items
            </div>
          )}
        </div>
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
}

function SortableCard<TItem>({ item, getItemId, renderCard, visiblePillKeys }: SortableCardProps<TItem>) {
  const id = getItemId(item);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-md transition-shadow hover:shadow-md',
        isDragging && 'opacity-30'
      )}
      {...attributes}
      {...listeners}
    >
      {renderCard(item, visiblePillKeys)}
    </div>
  );
}
