"use client";

import * as React from "react";
import { EntityList, type EntityListProps } from "./entity-list";
import { EntityToolbar } from "./entity-toolbar";
import { KanbanBoard, type KanbanColumnDef } from "./kanban-board";

export interface EntityCollectionProps<TItem> extends EntityListProps<TItem> {
  layout?: "list" | "board";
  board?: {
    columnDefs: KanbanColumnDef<TItem>[];
    renderCard: (item: TItem, visiblePillKeys: string[]) => React.ReactNode;
    onAdd?: (columnValue: unknown) => void;
  };
}

/** Stable controls and display state; only the layout renderer changes. */
export function EntityCollection<TItem>({
  layout = "list",
  board,
  ...props
}: EntityCollectionProps<TItem>) {
  const [internalCollapsedGroupKeys, setInternalCollapsedGroupKeys] =
    React.useState<Set<string>>(() => new Set());
  const [internalFilters, setInternalFilters] = React.useState<
    Record<string, unknown[]>
  >({});
  const [internalGroup, setInternalGroup] = React.useState<string | null>(null);
  const [internalSort, setInternalSort] = React.useState({
    key: "name",
    direction: "asc" as "asc" | "desc",
  });
  const [internalColumns, setInternalColumns] = React.useState(() =>
    props.rightPills
      .filter((p) => !p.filterOnly && p.visibleByDefault !== false)
      .map((p) => p.key),
  );
  const filters = props.filters ?? internalFilters;
  const groupBy = props.groupBy !== undefined ? props.groupBy : internalGroup;
  const sortBy = props.sortBy ?? internalSort.key;
  const direction = props.sortDirection ?? internalSort.direction;
  const columns = props.visiblePillKeys ?? internalColumns;
  const setFilters = props.onFiltersChange ?? setInternalFilters;
  const setGroup = props.onGroupByChange ?? setInternalGroup;
  const setSort =
    props.onSortChange ??
    ((key: string, direction: "asc" | "desc") =>
      setInternalSort({ key, direction }));
  const setColumns = props.onVisiblePillKeysChange ?? setInternalColumns;
  const boardMode = layout === "board" && board !== undefined;
  const activeColumn =
    board?.columnDefs.find((c) => c.key === groupBy) ?? board?.columnDefs[0];
  const common = {
    ...props,
    collapsedGroupKeys: props.collapsedGroupKeys ?? internalCollapsedGroupKeys,
    onCollapsedGroupKeysChange:
      props.onCollapsedGroupKeysChange ?? setInternalCollapsedGroupKeys,
    filters,
    onFiltersChange: setFilters,
    visiblePillKeys: columns,
    onVisiblePillKeysChange: setColumns,
    sortBy,
    sortDirection: direction,
    onSortChange: setSort,
    hideToolbar: true,
  };
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md bg-background">
      {!props.hideToolbar && (
        <div
          data-work-item-toolbar
          className="w-full min-w-0 shrink-0 border-b p-2"
        >
          <EntityToolbar
            viewTarget={props.viewTarget}
            statusColumn={props.statusColumn}
            rightPills={props.rightPills}
            filters={filters}
            onFiltersChange={setFilters}
            sortOptions={(props.sortByOptions ?? []).filter(
              (option) =>
                option.key !== (boardMode ? activeColumn?.key : groupBy),
            )}
            sortBy={sortBy}
            sortDirection={direction}
            onSortChange={setSort}
            groupOptions={
              boardMode
                ? board.columnDefs.map((c) => ({ key: c.key, label: c.label }))
                : (props.groupByOptions ?? [])
            }
            groupBy={boardMode ? (activeColumn?.key ?? null) : groupBy}
            groupByRequired={boardMode}
            onGroupByChange={(key) => {
              setGroup(key);
              if (key === sortBy) setSort("name", "asc");
            }}
            visiblePillKeys={columns}
            onVisiblePillKeysChange={setColumns}
            search={props.searchValue ?? ""}
            onSearchChange={props.onSearchChange}
            searchPlaceholder={props.searchPlaceholder ?? "Search..."}
            quickFilters={props.quickFilters}
            onApplyQuickFilter={props.onApplyQuickFilter}
            compact={props.compact}
          />
        </div>
      )}
      <div className="min-h-0 flex-1">
        {boardMode && activeColumn ? (
          <KanbanBoard
            {...common}
            columnDefs={board.columnDefs}
            activeColumnKey={activeColumn.key}
            onActiveColumnKeyChange={setGroup}
            renderCard={board.renderCard}
            onAdd={board.onAdd}
            groupBy={null}
          />
        ) : (
          <EntityList
            {...common}
            groupBy={groupBy}
            onGroupByChange={setGroup}
          />
        )}
      </div>
    </div>
  );
}
