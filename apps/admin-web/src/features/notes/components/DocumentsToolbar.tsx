"use client";

import { DataTableToolbar } from "@altitutor/ui";
import { defaultDocumentOrder, type DocumentOrder } from "../utils/documentOrder";

export function DocumentsToolbar({
  search,
  onSearchChange,
  order,
  onOrderChange,
  project = false,
}: {
  search: string;
  onSearchChange: (search: string) => void;
  order: DocumentOrder;
  onOrderChange: (order: DocumentOrder) => void;
  project?: boolean;
}) {
  return (
    <DataTableToolbar
      viewTarget={project ? "project-documents" : "documents"}
      hideViews
      searchPlaceholder="Search documents by title or content..."
      state={{
        search,
        sortBy: order.field,
        sortDirection: order.direction,
        filters: {},
        groupBy: null,
        page: 1,
        pageSize: 50,
        visibleColumns: [],
      }}
      sortOptions={[
        { key: "title", label: "Title" },
        { key: "updated_at", label: "Last updated" },
      ]}
      onSearchChange={onSearchChange}
      onSortChange={(field, direction) => onOrderChange(
        field ? { field: field === "updated_at" ? "updated_at" : "title", direction } : defaultDocumentOrder,
      )}
      onFiltersChange={() => {}}
      onGroupByChange={() => {}}
      onVisibleColumnsChange={() => {}}
      onQuickFilterApply={() => {}}
      onReset={() => {
        onSearchChange("");
        onOrderChange(defaultDocumentOrder);
      }}
    />
  );
}
