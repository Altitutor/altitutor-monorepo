"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type {
  DataTableColumnDefinition,
  DataTableFilterDefinition,
  DataTableSortOption,
} from "@altitutor/shared";
import { DataTable, DataTableToolbar, TablePagination } from "@altitutor/ui";
import { Eye } from "lucide-react";
import { useUcatAccess } from "@/features/ucat/shared/hooks/useUcatAccess";
import {
  UcatAccessDenied,
  UcatPageHeader,
  UcatPageSkeleton,
} from "@/features/ucat/shared/components";
import { useUcatStudentProgressSummary } from "@/features/ucat/students/hooks/useUcatStudents";
import {
  applySort,
  useVisibleColumns,
} from "@/features/ucat/shared/hooks/useUcatTableState";
import { useUcatTableUrlState } from "@/features/ucat/shared/hooks/useUcatTableUrlState";
import { UcatRowActions } from "@/features/ucat/shared/row-actions";
import type { StudentProgressSummaryRow } from "@/features/ucat/students/api/students";
import {
  tutorDataTableProps,
  tutorToolbarProps,
} from "@/shared/lib/tutor-visual";
import {
  getCognitivePredictedScore,
  UcatPredictedScoreCell,
} from "./UcatPredictedScoreCell";

export function UcatStudentsPage() {
  const access = useUcatAccess();
  const progress = useUcatStudentProgressSummary();
  const tableState = useUcatTableUrlState(
    [
      "student_name",
      "predicted_score",
      "delivery_mode",
      "online_tier",
      "actions",
    ],
    {
      availableColumns: [
        "student_name",
        "total_questions",
        "total_sets_attempted",
        "total_mocks_attempted",
        "predicted_score",
        "delivery_mode",
        "online_tier",
        "last_attempted_at",
        "actions",
      ],
    },
  );

  const classFilterValue =
    (tableState.state.filters.class_id?.[0] as string | undefined) ?? "all";
  const deliveryFilterValue =
    (tableState.state.filters.delivery_mode?.[0] as string | undefined) ??
    "all";
  const tierFilterValue =
    (tableState.state.filters.online_tier?.[0] as string | undefined) ?? "all";

  const rows = useMemo(
    () => progress.data?.students ?? [],
    [progress.data?.students],
  );
  const filteredRows = useMemo(() => {
    const search = tableState.state.search.trim().toLowerCase();
    return rows.filter((row) => {
      const searchHit =
        search.length === 0 || row.student_name.toLowerCase().includes(search);
      const classHit =
        classFilterValue === "all" || row.class_ids.includes(classFilterValue);
      const deliveryHit =
        deliveryFilterValue === "all" ||
        row.delivery_mode === deliveryFilterValue;
      const tierHit =
        tierFilterValue === "all" || row.online_tier === tierFilterValue;
      return searchHit && classHit && deliveryHit && tierHit;
    });
  }, [
    rows,
    tableState.state.search,
    classFilterValue,
    deliveryFilterValue,
    tierFilterValue,
  ]);

  const sortedRows = useMemo(
    () =>
      applySort(
        filteredRows,
        tableState.state.sortBy,
        tableState.state.sortDirection,
        {
          student_name: (r) => r.student_name,
          total_questions: (r) => r.total_questions,
          total_sets_attempted: (r) => r.total_sets_attempted,
          total_mocks_attempted: (r) => r.total_mocks_attempted,
          predicted_score: (r) =>
            getCognitivePredictedScore(r, progress.data?.sections ?? []) ?? -1,
          delivery_mode: (r) => r.delivery_mode,
          online_tier: (r) => r.online_tier,
          last_attempted_at: (r) => r.last_attempted_at ?? "",
        },
      ),
    [
      filteredRows,
      tableState.state.sortBy,
      tableState.state.sortDirection,
      progress.data?.sections,
    ],
  );

  const allColumns: Array<{
    key: string;
    column: ColumnDef<StudentProgressSummaryRow>;
  }> = [
    {
      key: "student_name",
      column: { accessorKey: "student_name", header: "Student" },
    },
    {
      key: "total_questions",
      column: { accessorKey: "total_questions", header: "Question attempts" },
    },
    {
      key: "total_sets_attempted",
      column: { accessorKey: "total_sets_attempted", header: "Set attempts" },
    },
    {
      key: "total_mocks_attempted",
      column: { accessorKey: "total_mocks_attempted", header: "Mock attempts" },
    },
    {
      key: "predicted_score",
      column: {
        id: "predicted_score",
        header: "Predicted score",
        accessorFn: (row: StudentProgressSummaryRow) =>
          getCognitivePredictedScore(row, progress.data?.sections ?? []),
        cell: ({ row }: { row: { original: StudentProgressSummaryRow } }) => (
          <UcatPredictedScoreCell
            student={row.original}
            sections={progress.data?.sections ?? []}
          />
        ),
      },
    },
    {
      key: "delivery_mode",
      column: {
        accessorKey: "delivery_mode",
        header: "Delivery",
        cell: ({ row }) =>
          row.original.delivery_mode === "in_person" ? "In person" : "Online",
      },
    },
    {
      key: "online_tier",
      column: {
        accessorKey: "online_tier",
        header: "Online plan",
        cell: ({ row }) =>
          row.original.online_tier === "unlimited" ? "Unlimited" : "Free",
      },
    },
    {
      key: "last_attempted_at",
      column: {
        accessorKey: "last_attempted_at",
        header: "Last Attempted",
        cell: ({ row }) =>
          row.original.last_attempted_at
            ? new Date(row.original.last_attempted_at).toLocaleString()
            : "-",
      },
    },
    {
      key: "actions",
      column: {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex justify-end">
            <UcatRowActions
              actions={[
                {
                  label: "View",
                  icon: <Eye className="h-4 w-4" />,
                  href: `/ucat/students/${row.original.student_id}`,
                },
              ]}
            />
          </div>
        ),
      },
    },
  ];

  const visibleColumns = useVisibleColumns(
    allColumns,
    [...tableState.state.visibleColumns, "actions"].filter(
      (k, i, arr) => arr.indexOf(k) === i,
    ),
  );
  const { page, pageSize } = tableState.state;
  const totalRows = sortedRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const effectivePage = Math.min(page, pageCount);
  const paginatedRows = sortedRows.slice(
    (effectivePage - 1) * pageSize,
    effectivePage * pageSize,
  );

  const columnDefinitions = useMemo(
    () =>
      [
        { key: "student_name", label: "Student", visibleByDefault: true },
        {
          key: "total_questions",
          label: "Question attempts",
          visibleByDefault: false,
        },
        {
          key: "total_sets_attempted",
          label: "Set attempts",
          visibleByDefault: false,
        },
        {
          key: "total_mocks_attempted",
          label: "Mock attempts",
          visibleByDefault: false,
        },
        {
          key: "predicted_score",
          label: "Predicted score",
          visibleByDefault: true,
        },
        { key: "delivery_mode", label: "Delivery", visibleByDefault: true },
        { key: "online_tier", label: "Online plan", visibleByDefault: true },
        {
          key: "last_attempted_at",
          label: "Last Attempted",
          visibleByDefault: false,
        },
      ] as DataTableColumnDefinition[],
    [],
  );

  const sortOptions: DataTableSortOption[] = useMemo(
    () => [
      { key: "student_name", label: "Student" },
      { key: "total_questions", label: "Question attempts" },
      { key: "total_sets_attempted", label: "Set attempts" },
      { key: "total_mocks_attempted", label: "Mock attempts" },
      { key: "predicted_score", label: "Predicted score" },
      { key: "delivery_mode", label: "Delivery" },
      { key: "online_tier", label: "Online plan" },
      { key: "last_attempted_at", label: "Last Attempted" },
    ],
    [],
  );

  if (access.isLoading || progress.isLoading)
    return <UcatPageSkeleton rows={8} />;
  if (!access.data) return <UcatAccessDenied />;

  const filters: DataTableFilterDefinition[] = [
    {
      key: "class_id",
      label: "Class",
      options: (progress.data?.classes ?? []).map((row) => ({
        label: row.name,
        value: row.id,
      })),
    },
    {
      key: "delivery_mode",
      label: "Delivery",
      options: [
        { label: "In person", value: "in_person" },
        { label: "Online", value: "online" },
      ],
    },
    {
      key: "online_tier",
      label: "Online plan",
      options: [
        { label: "Free", value: "free" },
        { label: "Unlimited", value: "unlimited" },
      ],
    },
  ];

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="UCAT Students"
        description="Track student progress across sets and mocks"
        backHref="/ucat"
        breadcrumbs={[{ label: "UCAT", href: "/ucat" }, { label: "Students" }]}
      />

      <DataTableToolbar
        state={tableState.state}
        onSearchChange={tableState.actions.onSearchChange}
        onFiltersChange={tableState.actions.onFiltersChange}
        onSortChange={tableState.actions.onSortChange}
        onGroupByChange={tableState.actions.onGroupByChange}
        onVisibleColumnsChange={(cols) =>
          tableState.actions.onVisibleColumnsChange([
            ...cols.filter((c) => c !== "actions"),
            "actions",
          ])
        }
        onQuickFilterApply={tableState.actions.onQuickFilterApply}
        onReset={tableState.actions.onReset}
        filterDefinitions={filters}
        columnDefinitions={columnDefinitions}
        sortOptions={sortOptions}
        {...tutorToolbarProps}
        searchPlaceholder="Search students"
      />

      <div className="pt-3">
        <DataTable
          {...tutorDataTableProps}
          columns={visibleColumns}
          data={paginatedRows}
          pagination="external"
          pageSizeOptions={[10, 20, 50]}
        />
        <TablePagination
          page={effectivePage}
          pageSize={pageSize}
          total={totalRows}
          onPageChange={tableState.actions.onPageChange}
          onPageSizeChange={tableState.actions.onPageSizeChange}
          pageSizeOptions={[10, 20, 50]}
          className="pt-3"
        />
      </div>
    </div>
  );
}
