"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Badge,
  Button,
  DataTableToolbar,
  SkeletonTable,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
} from "@altitutor/ui";
import type {
  DataTableColumnDefinition,
  DataTableFilterDefinition,
  DataTableSortOption,
} from "@altitutor/shared";
import { useDataTable } from "@/shared/hooks/useDataTable";
import { useQuickFilters } from "@/features/quick-filters/hooks/useQuickFilters";
import { useCurrentStaff } from "@/shared/hooks";
import { useBillingPricing } from "@/features/billing/hooks/useBillingPricing";
import { useSubjects } from "@/features/subjects";
import { formatDate, getSubjectColorStyle } from "@/shared/utils";
import { fetchSubsidies, type SubsidyRow } from "../api/subsidies";

const defaultFilters = { status: ["active"] };
const defaultSort = { field: "effective_from", direction: "desc" as const };
const defaultVisibleColumns = [
  "student",
  "subject",
  "price_cents",
  "default_price",
  "status",
];
const columnDefinitions: DataTableColumnDefinition[] = [
  { key: "student", label: "Student", visibleByDefault: true },
  { key: "subject", label: "Subject", visibleByDefault: true },
  { key: "price_cents", label: "Subsidy price", visibleByDefault: true },
  { key: "default_price", label: "Default price", visibleByDefault: true },
  { key: "status", label: "Status", visibleByDefault: true },
  { key: "effective_from", label: "Effective from", visibleByDefault: false },
  { key: "effective_until", label: "Effective until", visibleByDefault: false },
];
const sortOptions: DataTableSortOption[] = [
  { key: "price_cents", label: "Subsidy price" },
  { key: "effective_from", label: "Effective from" },
  { key: "effective_until", label: "Effective until" },
];
const defaultView = {
  name: "Active subsidies",
  settings: {
    filters: defaultFilters,
    sortBy: defaultSort.field,
    sortDirection: defaultSort.direction,
    groupBy: null,
    visibleColumns: defaultVisibleColumns,
  },
};

export function SubsidiesTable() {
  const {
    state,
    setSearch,
    setSort,
    setFilters,
    setPage,
    setPageSize,
    setVisibleColumns,
    applyQuickFilter,
    resetFilters,
  } = useDataTable({
    defaultFilters,
    defaultSort,
    defaultVisibleColumns,
    filterKeys: ["status", "subject"],
  });
  const { data: currentStaff } = useCurrentStaff();
  const { data: quickFilters = [] } = useQuickFilters("subsidies", defaultView);
  const { data: subjects = [] } = useSubjects();
  const pricing = useBillingPricing();
  const query = useQuery({
    queryKey: [
      "subsidies",
      state.search,
      state.filters,
      state.sortBy,
      state.sortDirection,
      state.page,
      state.pageSize,
    ],
    queryFn: () =>
      fetchSubsidies({
        search: state.search,
        statuses: state.filters.status as string[],
        subjectIds: state.filters.subject as string[],
        page: state.page,
        pageSize: state.pageSize,
        sortBy: state.sortBy,
        ascending: state.sortDirection === "asc",
      }),
    // Re-evaluate date-derived status while the page remains open.
    refetchInterval: 30_000,
  });
  const filterDefinitions: DataTableFilterDefinition[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { label: "Active", value: "active" },
        { label: "Inactive", value: "inactive" },
      ],
    },
    {
      key: "subject",
      label: "Subject",
      options: subjects.map((subject) => ({
        value: subject.id,
        label: subject.long_name ?? subject.name,
      })),
    },
  ];
  const columns = columnDefinitions.filter((column) =>
    state.visibleColumns.includes(column.key),
  );
  const now = Date.now();
  const renderCell = (subsidy: SubsidyRow, column: string) => {
    switch (column) {
      case "student":
        return (
          <Link
            className="font-medium hover:underline"
            href={`/students/${subsidy.student_id}`}
          >
            {[subsidy.student.first_name, subsidy.student.last_name]
              .filter(Boolean)
              .join(" ") || "Unnamed student"}
          </Link>
        );
      case "subject": {
        const { style, textColorClass } = getSubjectColorStyle(subsidy.subject);
        return (
          <div className="space-y-1">
            <Badge variant="secondary" style={style} className={textColorClass}>
              {subsidy.subject.short_name ??
                subsidy.subject.long_name ??
                subsidy.subject.name}
            </Badge>
            <div className="text-xs text-muted-foreground">
              {subsidy.billing_type.replaceAll("_", " ")}
            </div>
          </div>
        );
      }
      case "price_cents":
        return `$${(subsidy.price_cents / 100).toFixed(2)} ${subsidy.currency}/hour`;
      case "default_price": {
        if (pricing.isLoading)
          return <span className="text-muted-foreground">Loading…</span>;
        if (pricing.isError)
          return (
            <Button
              variant="link"
              onClick={() => {
                void pricing.refetch();
              }}
            >
              Retry pricing
            </Button>
          );
        const rate = pricing.data?.find(
          (price) => price.billing_type === subsidy.billing_type,
        );
        return rate ? (
          `$${(rate.hourly_rate_cents / 100).toFixed(2)} ${rate.currency}/hour`
        ) : (
          <span className="text-muted-foreground">N/A</span>
        );
      }
      case "status": {
        const active =
          Date.parse(subsidy.effective_from) <= now &&
          (subsidy.effective_until === null ||
            Date.parse(subsidy.effective_until) > now);
        return (
          <Badge variant={active ? "success" : "secondary"}>
            {active ? "Active" : "Inactive"}
          </Badge>
        );
      }
      case "effective_from":
        return formatDate(subsidy.effective_from);
      case "effective_until":
        return subsidy.effective_until
          ? formatDate(subsidy.effective_until)
          : "Indefinitely";
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <DataTableToolbar
        state={state}
        onSearchChange={setSearch}
        onFiltersChange={setFilters}
        onSortChange={setSort}
        onGroupByChange={() => {}}
        onVisibleColumnsChange={setVisibleColumns}
        onQuickFilterApply={(view) => applyQuickFilter(view, currentStaff?.id)}
        onReset={resetFilters}
        filterDefinitions={filterDefinitions}
        sortOptions={sortOptions}
        columnDefinitions={columnDefinitions}
        quickFilters={quickFilters}
        viewTarget="subsidies"
        searchPlaceholder="Search student names…"
        isLoading={query.isFetching}
      />
      {query.isError ? (
        <div role="alert" className="p-4 text-destructive">
          Failed to load subsidies.{" "}
          <Button
            variant="outline"
            onClick={() => {
              void query.refetch();
            }}
          >
            Retry
          </Button>
        </div>
      ) : query.isLoading ? (
        <SkeletonTable rows={8} columns={columns.length} />
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key}>{column.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data?.subsidies.length ? (
                query.data.subsidies.map((subsidy) => (
                  <TableRow key={subsidy.id}>
                    {columns.map((column) => (
                      <TableCell key={column.key}>
                        {renderCell(subsidy, column.key)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={Math.max(1, columns.length)}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No subsidies match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <TablePagination
        page={state.page}
        pageSize={state.pageSize}
        total={query.data?.total ?? 0}
        isFetching={query.isFetching}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
