"use client";
import type { IssueUpdate } from "../types";
import { IssueCard } from "./IssueCard";
import { CreateIssueDialog } from "./CreateIssueDialog";

import { useQuickFilters } from "@/features/quick-filters/hooks/useQuickFilters";

import React, { useState, useMemo, useCallback } from "react";
import {
  EntityCollection,
  type KanbanColumnDef,
  type EntityListStatusColumn,
  type EntityListPillColumn,
} from "@altitutor/ui";
import { AdminRichTextEditorWithImages } from "@/features/rich-text-images";
import { useIssues } from "../api/queries";
import { useUpdateIssue, useCreateIssue } from "../api/mutations";
import { useCurrentStaff } from "@/shared/hooks";
import { EditIssueDialog } from "./EditIssueDialog";
import { IssueDueDateEntityPill } from "./IssueDueDateEntityPill";
import { cn } from "@/shared/utils";
import type { IssueWithTags, IssueStatus } from "../types";
import {
  formatIssueDueDate,
  getIssueStatusIcon,
  getIssueStatusIconColor,
  getIssueStatusLabel,
  getIssueStatusOrder,
  ISSUE_STATUS_OPTIONS,
} from "../utils/issueUtils";
import { useEntityListTableState } from "@/shared/hooks/useEntityListTableState";

const ISSUE_FILTER_KEYS = ["status", "due_date"] as const;

export interface IssuesListProps {
  layout?: "list" | "board";
  /** Initial filter values (e.g. dashboard: open only) */
  defaultFilters?: Record<string, unknown[]>;
  /** Force collapsed pill layout (e.g. dashboard cards) */
  compact?: boolean;
  hideToolbar?: boolean;
  embedView?: {
    groupBy?: string | null;
    sortBy?: string;
    sortDirection?: "asc" | "desc";
  };
}

export function IssuesList({
  layout = "list",
  defaultFilters,
  compact = false,
  hideToolbar = false,
  embedView,
}: IssuesListProps = {}) {
  const embedLocked = hideToolbar && embedView != null;

  const { data: savedViews = [] } = useQuickFilters("issues");
  const {
    visiblePillKeys,
    setVisiblePillKeys,
    applyQuickFilter,
    filters,
    setFilters,
    search,
    setSearch,
    groupBy,
    setGroupBy,
    sortBy,
    sortDirection,
    handleSortChange,
  } = useEntityListTableState({
    defaultFilters: defaultFilters ?? {},
    defaultSort: embedLocked
      ? {
          field: embedView?.sortBy ?? "name",
          direction: embedView?.sortDirection ?? "asc",
        }
      : { field: "name", direction: "asc" },
    defaultGroupBy: embedLocked ? (embedView?.groupBy ?? null) : "status",
    filterKeys: [...ISSUE_FILTER_KEYS],
    skipUrlSync: embedLocked,
  });

  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const { data: issues = [], isLoading } = useIssues({ ...filters, search });
  const updateIssue = useUpdateIssue();
  const createIssue = useCreateIssue();
  const { data: currentStaff } = useCurrentStaff();

  const handleStatusChange = useCallback(
    (issue: IssueWithTags, value: IssueStatus) => {
      const updates: { status: IssueStatus; resolved_by?: string | null } = {
        status: value,
      };
      if (value === "resolved") {
        updates.resolved_by = currentStaff?.id ?? null;
      }
      updateIssue.mutate({ id: issue.id, updates });
    },
    [updateIssue, currentStaff?.id],
  );

  const handleAdd = useCallback(
    async (
      data: { name: string; description?: string } & Record<string, unknown>,
    ) => {
      await createIssue.mutateAsync({
        issue: {
          name: data.name,
          description: (data.description ??
            null) as import("../types").IssueInsert["description"],
          status: (data.status as IssueStatus) ?? "open",
          due_date:
            data.due_date != null && data.due_date !== ""
              ? new Date(data.due_date as string).toISOString()
              : null,
          created_by: currentStaff?.id ?? null,
        },
      });
    },
    [createIssue, currentStaff?.id],
  );

  const statusColumn: EntityListStatusColumn<IssueWithTags, unknown> = {
    key: "status",
    label: "Status",
    getValue: (i) => i.status as IssueStatus,
    defaultValue: "open",
    filterable: true,
    options: ISSUE_STATUS_OPTIONS.map((opt) => ({
      value: opt.value,
      label: opt.label,
      icon: getIssueStatusIcon(opt.value),
    })),
    renderBubble: (value: unknown, collapsed) => {
      const status = value as IssueStatus;
      const option =
        ISSUE_STATUS_OPTIONS.find((o) => o.value === status) ??
        ISSUE_STATUS_OPTIONS[0];
      const Icon = getIssueStatusIcon(status);
      const iconColor = getIssueStatusIconColor(status);

      if (collapsed) return <Icon className={cn("h-3 w-3", iconColor)} />;

      return (
        <span
          className={cn("inline-flex items-center gap-1.5 text-xs", iconColor)}
        >
          <Icon className="h-3 w-3" />
          {option.label}
        </span>
      );
    },
    onStatusChange: (issue, value) =>
      handleStatusChange(issue, value as IssueStatus),
  };

  const rightPills: EntityListPillColumn<IssueWithTags, unknown>[] = useMemo(
    () => [
      {
        key: "due_date",
        label: "Due date",
        visibleByDefault: true,
        getValue: (issue) => issue.due_date ?? null,
        defaultValue: null,
        filterType: "date-range",
        groupable: true,
        sortable: true,
        filterable: true,
        compare: (a, b) => {
          const aTime = a
            ? new Date(String(a)).getTime()
            : Number.POSITIVE_INFINITY;
          const bTime = b
            ? new Date(String(b)).getTime()
            : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        },
        renderPill: (item, onChange, collapsed) => (
          <IssueDueDateEntityPill
            dueDate={item.due_date}
            collapsed={collapsed}
            onChange={(nextDate) => {
              const nextDueDate = nextDate
                ? new Date(nextDate).toISOString()
                : null;
              updateIssue.mutate({
                id: item.id,
                updates: { due_date: nextDueDate },
              });
              onChange(nextDueDate);
            }}
          />
        ),
      },
    ],
    [updateIssue],
  );

  const groupByOptions = useMemo(
    () => [
      { key: "status", label: "Status" },
      { key: "due_date", label: "Due date" },
    ],
    [],
  );

  const sortByOptions = useMemo(
    () => [
      { key: "status", label: "Status" },
      { key: "due_date", label: "Due date" },
    ],
    [],
  );

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createColumnValue, setCreateColumnValue] =
    useState<IssueStatus>("open");
  const [createDefaultDueDate, setCreateDefaultDueDate] = useState<
    string | null
  >(null);
  const handleBoardUpdate = useCallback(
    (issue: IssueWithTags, updates: Partial<IssueUpdate>) => {
      const finalUpdates = { ...updates };
      if (updates.status === "resolved") {
        finalUpdates.resolved_by = currentStaff?.id ?? null;
      }
      updateIssue.mutate({ id: issue.id, updates: finalUpdates });
    },
    [updateIssue, currentStaff?.id],
  );
  const dueDateColumnOptions = useMemo(() => {
    const dates = Array.from(
      new Set(
        issues
          .map((issue) => issue.due_date)
          .filter((date): date is string => !!date),
      ),
    )
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((date) => ({
        value: date as unknown,
        label: formatIssueDueDate(date),
      }));
    return [{ value: "__null__" as unknown, label: "No due date" }, ...dates];
  }, [issues]);

  const columnDefs: KanbanColumnDef<IssueWithTags, unknown>[] = useMemo(
    () => [
      {
        key: "status",
        label: "Status",
        getValue: (i) => i.status,
        options: ISSUE_STATUS_OPTIONS.map((opt) => ({
          value: opt.value,
          label: opt.label,
        })),
        onValueChange: (i, v) =>
          handleBoardUpdate(i, { status: v as IssueStatus }),
      },
      {
        key: "due_date",
        label: "Due date",
        getValue: (i) => i.due_date ?? "__null__",
        options: dueDateColumnOptions,
        onValueChange: (i, v) =>
          handleBoardUpdate(i, {
            due_date: v === "__null__" ? null : (v as string),
          }),
      },
    ],
    [handleBoardUpdate, dueDateColumnOptions],
  );

  const activeColumnKey =
    groupBy && columnDefs.some((column) => column.key === groupBy)
      ? groupBy
      : "status";
  const handleBoardAdd = useCallback(
    (columnValue: unknown) => {
      if (activeColumnKey === "status") {
        setCreateColumnValue(columnValue as IssueStatus);
        setCreateDefaultDueDate(null);
      } else if (activeColumnKey === "due_date") {
        setCreateColumnValue("open");
        setCreateDefaultDueDate(
          columnValue === "__null__" ? null : (columnValue as string),
        );
      }
      setIsCreateDialogOpen(true);
    },
    [activeColumnKey],
  );
  return (
    <>
      <EntityCollection<IssueWithTags>
        viewTarget="issues"
        quickFilters={savedViews}
        onApplyQuickFilter={(view) => applyQuickFilter(view, currentStaff?.id)}
        layout={layout}
        board={{
          columnDefs,
          renderCard: (item, keys) => (
            <IssueCard
              issue={item}
              rightPills={rightPills}
              visiblePillKeys={keys}
              onOpen={(id) => {
                setSelectedIssueId(id);
                setIsEditDialogOpen(true);
              }}
            />
          ),
          onAdd: handleBoardAdd,
        }}
        items={issues}
        getItemId={(i) => i.id}
        renderName={(i) => i.name ?? ""}
        statusColumn={statusColumn}
        rightPills={rightPills}
        visiblePillKeys={visiblePillKeys}
        onVisiblePillKeysChange={setVisiblePillKeys}
        groupByOptions={hideToolbar ? [] : groupByOptions}
        sortByOptions={sortByOptions}
        groupBy={embedLocked ? (embedView?.groupBy ?? null) : groupBy}
        onGroupByChange={embedLocked ? undefined : setGroupBy}
        sortBy={embedLocked ? (embedView?.sortBy ?? "name") : sortBy}
        sortDirection={
          embedLocked ? (embedView?.sortDirection ?? "asc") : sortDirection
        }
        onSortChange={embedLocked ? undefined : handleSortChange}
        getGroupOrder={(columnKey, valueKey) => {
          if (columnKey === "status") {
            return getIssueStatusOrder(valueKey);
          }
          return 0;
        }}
        getGroupLabel={(columnKey, valueKey) => {
          if (columnKey === "status") {
            if (valueKey === "__null__") return "No status";
            return getIssueStatusLabel(valueKey as IssueStatus);
          }
          if (columnKey === "due_date") {
            if (valueKey === "__null__") return "No due date";
            return formatIssueDueDate(valueKey);
          }
          return valueKey === "__null__" ? "No value" : valueKey;
        }}
        onAdd={hideToolbar ? undefined : handleAdd}
        onRowClick={(i) => {
          setSelectedIssueId(i.id);
          setIsEditDialogOpen(true);
        }}
        addButtonLabel="Add issue"
        addButtonVariant="default"
        addButtonShowLabel={true}
        emptyMessage="No issues match your filters"
        isLoading={isLoading}
        noPadding={true}
        hideToolbar={hideToolbar}
        compact={compact}
        filters={filters}
        onFiltersChange={hideToolbar ? undefined : setFilters}
        searchValue={search}
        onSearchChange={hideToolbar ? undefined : setSearch}
        searchPlaceholder="Search issues..."
        descriptionConfig={
          hideToolbar
            ? undefined
            : {
                enabled: true,
                renderEditor: ({ value, onChange, placeholder, ref }) => (
                  <AdminRichTextEditorWithImages
                    ref={
                      ref as React.RefObject<
                        import("@altitutor/ui").RichTextEditorRef
                      >
                    }
                    content={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className="min-h-[60px]"
                    context="issues"
                  />
                ),
                placeholder: "Add issue description...",
              }
        }
      />

      {selectedIssueId && (
        <EditIssueDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedIssueId(null);
          }}
          issueId={selectedIssueId}
        />
      )}
      <CreateIssueDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        initialStatus={createColumnValue}
        initialDueDate={createDefaultDueDate}
      />
    </>
  );
}
