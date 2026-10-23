"use client";

import * as React from "react";
import type { DataTableFilterDefinition } from "@altitutor/shared";
import type {
  EntityListPillColumn,
  EntityListStatusColumn,
  QuickFilter,
} from "./entity-list";
import { DataTableToolbar } from "./data-table-toolbar";
import { useToolbarView } from "./toolbar-view";
import { Checkbox } from "./checkbox";

type Column = {
  key: string;
  label: string;
  options: Array<{ value: unknown; label: string }>;
  filterable?: boolean;
};
type StoredDateRange = {
  type: "date_range";
  start?: string;
  end?: string;
  operator?: "gte" | "lte";
};

export function EntityToolbar<TItem>({
  viewTarget,
  statusColumn,
  rightPills,
  columnDefs = [],
  filters,
  onFiltersChange,
  sortOptions,
  sortBy,
  sortDirection,
  onSortChange,
  groupOptions,
  groupBy,
  onGroupByChange,
  groupByRequired,
  visiblePillKeys,
  onVisiblePillKeysChange,
  search,
  onSearchChange,
  searchPlaceholder,
  quickFilters = [],
  onApplyQuickFilter,
  compact,
  viewContent,
}: {
  viewTarget?: string;
  statusColumn?: EntityListStatusColumn<TItem, unknown>;
  rightPills: EntityListPillColumn<TItem, unknown>[];
  columnDefs?: Column[];
  filters: Record<string, unknown[]>;
  onFiltersChange: (filters: Record<string, unknown[]>) => void;
  sortOptions: Array<{ key: string; label: string }>;
  sortBy: string;
  sortDirection: "asc" | "desc";
  onSortChange: (key: string, direction: "asc" | "desc") => void;
  groupOptions: Array<{ key: string; label: string }>;
  groupBy: string | null;
  onGroupByChange: (key: string | null) => void;
  groupByRequired?: boolean;
  visiblePillKeys: string[];
  onVisiblePillKeysChange: (keys: string[]) => void;
  search: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder: string;
  quickFilters?: QuickFilter[];
  onApplyQuickFilter?: (filter: QuickFilter) => void;
  compact?: boolean;
  viewContent?: React.ReactNode;
}) {
  const view = useToolbarView();
  const definitions = new Map<string, DataTableFilterDefinition>();
  for (const column of [statusColumn, ...columnDefs]) {
    if (column && column.filterable !== false)
      definitions.set(column.key, {
        key: column.key,
        label: column.label,
        options: column.options,
        choiceOperators: true,
      });
  }
  for (const pill of rightPills) {
    if (pill.filterable === false || definitions.has(pill.key)) continue;
    if (pill.filterType === "date-range")
      definitions.set(pill.key, {
        key: pill.key,
        label: pill.label,
        type: "date-range",
        fromKey: `${pill.key}__from`,
        toKey: `${pill.key}__to`,
      });
    else if (pill.filterOptions?.length)
      definitions.set(pill.key, {
        key: pill.key,
        label: pill.label,
        options: pill.filterOptions,
        choiceOperators: true,
      });
  }
  const dateColumns = rightPills.filter(
    (pill) => definitions.get(pill.key)?.type === "date-range",
  );
  const toToolbarFilters = (storedFilters: Record<string, unknown[]>) => {
    const toolbarFilters = { ...storedFilters };
    for (const pill of dateColumns) {
      const stored = storedFilters[pill.key]?.[0] as
        | StoredDateRange
        | undefined;
      delete toolbarFilters[pill.key];
      if (stored?.type !== "date_range") continue;
      if (stored.start) toolbarFilters[`${pill.key}__from`] = [stored.start];
      if (stored.end) toolbarFilters[`${pill.key}__to`] = [stored.end];
    }
    return toolbarFilters;
  };
  const toolbarFilters = toToolbarFilters(filters);
  const toStoredFilters = (next: Record<string, unknown[]>) => {
    const result = { ...next };
    for (const pill of dateColumns) {
      const start = result[`${pill.key}__from`]?.[0];
      const end = result[`${pill.key}__to`]?.[0];
      delete result[`${pill.key}__from`];
      delete result[`${pill.key}__to`];
      if (start || end)
        result[pill.key] = [
          {
            type: "date_range",
            ...(start ? { start: String(start) } : {}),
            ...(end ? { end: String(end) } : {}),
            ...(!start && end
              ? { operator: "lte" as const }
              : start && !end
                ? { operator: "gte" as const }
                : {}),
          } satisfies StoredDateRange,
        ];
      else delete result[pill.key];
    }
    return result;
  };
  const changeFilters = (next: Record<string, unknown[]>) =>
    onFiltersChange(toStoredFilters(next));
  const columns = rightPills
    .filter((pill) => !pill.filterOnly)
    .map((pill) => ({
      key: pill.key,
      label: pill.label,
      visibleByDefault: pill.visibleByDefault !== false,
    }));
  return (
    <DataTableToolbar
      viewTarget={viewTarget}
      filterStateAdapter={{ read: toToolbarFilters, write: toStoredFilters }}
      state={{
        search,
        filters: toolbarFilters,
        sortBy: sortBy === "name" ? null : sortBy,
        sortDirection,
        groupBy,
        page: 1,
        pageSize: 20,
        visibleColumns: visiblePillKeys,
      }}
      onSearchChange={onSearchChange ?? (() => {})}
      hideSearch={!onSearchChange}
      onFiltersChange={changeFilters}
      filterDefinitions={[...definitions.values()]}
      sortOptions={sortOptions}
      onSortChange={(key, direction) =>
        onSortChange(key ?? "name", key === null ? "asc" : direction)
      }
      groupByOptions={groupOptions}
      onGroupByChange={onGroupByChange}
      groupByRequired={groupByRequired}
      columnDefinitions={columns}
      columnHeading="Show pills"
      defaultVisibleColumns={columns
        .filter((column) => column.visibleByDefault)
        .map((column) => column.key)}
      onVisibleColumnsChange={onVisiblePillKeysChange}
      allowEmptyColumns
      view={view}
      viewContent={viewContent}
      quickFilters={quickFilters}
      onQuickFilterApply={(filter) =>
        onApplyQuickFilter
          ? onApplyQuickFilter(filter)
          : onFiltersChange(filter.config)
      }
      onReset={() => onFiltersChange({})}
      searchPlaceholder={searchPlaceholder}
      compact={compact}
    />
  );
}

export function BoardEmptyColumnsControl({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 px-3 py-2 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      Hide empty columns
    </label>
  );
}
