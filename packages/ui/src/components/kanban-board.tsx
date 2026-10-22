'use client';

import { EntityToolbar, BoardEmptyColumnsControl } from './entity-toolbar';


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
import { ScrollArea } from './scroll-area';
import { cn } from '../lib/cn';
import {
  Plus,
} from 'lucide-react';
import { isFilterMetadata } from '@altitutor/shared';
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
  hideToolbar?: boolean;
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

  viewTarget?: string;
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
    onHideEmptyColumnsChange,
    visiblePillKeys: controlledVisiblePills,
    onVisiblePillKeysChange,
    viewTarget,
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
  const groupBy = controlledGroupBy !== undefined ? controlledGroupBy : internalGroupBy;
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const activeFilterCount = Object.values(filters).reduce((acc, arr) => acc + (arr?.length ?? 0), 0);

  const filteredItems = React.useMemo(() => {
    let result = items;
    if (activeFilterCount > 0) {
      result = result.filter((item) => {
        for (const columnKey of Object.keys(filters)) {
          if (isFilterMetadata(columnKey)) continue;
          const selected = filters[columnKey];
          if (!selected?.length) continue;

          const value = getPropValue(item, columnKey, rightPills, statusColumn, columnDefs);
          const match = selectedFilterMatchesValue(selected, value, filters[`${columnKey}__operator`]?.[0]);
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
      {!props.hideToolbar && <div data-work-item-toolbar className="w-full min-w-0 shrink-0 border-b p-2">
        <EntityToolbar
            viewTarget={viewTarget}
          statusColumn={statusColumn} rightPills={rightPills} columnDefs={columnDefs}
          filters={filters} onFiltersChange={setFilters}
          sortOptions={visibleSortByOptions} sortBy={sortBy} sortDirection={sortDirection} onSortChange={setSortBy}
          groupOptions={columnDefs.length > 1 ? columnDefs.map((column) => ({ key: column.key, label: column.label })) : []}
          groupBy={activeColumnDef.key} onGroupByChange={(key) => { if (key) onActiveColumnKeyChange?.(key); }} groupByRequired
          visiblePillKeys={visiblePillKeys} onVisiblePillKeysChange={setVisiblePillKeys}
          search={searchValue ?? ''} onSearchChange={onSearchChange} searchPlaceholder={searchPlaceholder}
          quickFilters={quickFilters} onApplyQuickFilter={onApplyQuickFilter}
          viewContent={onHideEmptyColumnsChange ? <BoardEmptyColumnsControl checked={hideEmptyColumns} onChange={onHideEmptyColumnsChange} /> : undefined}
        />
      </div>}

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
