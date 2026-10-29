"use client";
import { TutorEntityToolbar } from '@/features/quick-filters/components/TutorEntityToolbar'
import { tutorDefaultDisplaySettings } from '@altitutor/shared'

import { useMemo, useState } from "react";
import {
  Button,
  DataTable,
  TablePagination,
} from "@altitutor/ui";
import type {
  DataTableColumnDefinition,
  DataTableSortOption,
  InterviewTemplate,
  InterviewStation,
} from "@altitutor/shared";
import { Pencil, Plus, Printer } from "lucide-react";
import { UcatRowActions } from "@/features/ucat/shared/row-actions";
import {
  tutorBtnPrimary,
  tutorDataTableProps,
  tutorToolbarProps,
} from "@/shared/lib/tutor-visual";
import { useInterviewCatalog } from "../hooks/use-interviews";
import { InterviewError } from "./interview-ui";
import { InterviewPageHeader, interviewCrumbs } from "./interview-page";
import {
  createBlankInterview,
  InterviewEditorDialog,
} from "./InterviewEditorDialog";
import { InterviewPrintDialog } from "./InterviewPrintDialog";
import { pageRows, sortRows, useInterviewTable } from "./interview-table";

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: "name", label: "Interview", visibleByDefault: true },
  { key: "stations", label: "Stations", visibleByDefault: true },
  { key: "questions", label: "Questions", visibleByDefault: true },
  { key: "timing", label: "Reading / answer", visibleByDefault: true },
  { key: "points", label: "Total points", visibleByDefault: true },
  { key: "updated", label: "Updated", visibleByDefault: false },
];

const sortOptions: DataTableSortOption[] = [
  { key: "updated", label: "Updated" },
  { key: "name", label: "Name" },
];

function questionCount(interview: InterviewTemplate, bank: InterviewStation[]) {
  return interview.stations.reduce(
    (sum, station) => sum + (bank.find((s) => s.id === station.stationId)?.questions.length ?? 0),
    0,
  );
}

function totalPoints(interview: InterviewTemplate, bank: InterviewStation[]) {
  return interview.stations.reduce(
    (sum, station) => sum + (bank.find((s) => s.id === station.stationId)?.maximumPoints ?? 0),
    0,
  );
}

function formatMinutes(seconds: number) {
  const minutes = seconds / 60;
  return Number.isInteger(minutes) ? `${minutes}m` : `${minutes.toFixed(1)}m`;
}

export function InterviewBankPage() {
  const catalogQuery = useInterviewCatalog();
  const catalog = catalogQuery.data;
  const table = useInterviewTable(
    columnDefinitions
      .filter((column) => column.visibleByDefault)
      .map((column) => column.key),
  );
  const [creating, setCreating] = useState<InterviewTemplate | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [printing, setPrinting] = useState<InterviewTemplate | null>(null);

  const interviews = useMemo(() => {
    const query = table.state.search.trim().toLowerCase();
    const rows = (catalog?.interviews ?? []).filter(
      (interview) =>
        !interview.archived &&
        (!query || interview.name.toLowerCase().includes(query)),
    );
    return sortRows(rows, table.state, "updated", {
      updated: (interview) => interview.updatedAt,
      name: (interview) => interview.name,
    });
  }, [catalog?.interviews, table.state]);

  const paged = pageRows(interviews, table.state.page, table.state.pageSize);
  const visible = new Set(table.state.visibleColumns);
  const editing =
    catalog?.interviews.find((interview) => interview.id === editingId) ?? null;
  const dialogInterview = creating ?? editing;

  return (
    <div className="space-y-6 py-8 md:py-10">
      <InterviewPageHeader
        title="Interview bank"
        backHref="/interviews"
        backLabel="Back to interviews"
        breadcrumbs={interviewCrumbs("Interview bank")}
        actions={
          <Button
            className={tutorBtnPrimary}
            onClick={() => {
              setEditingId(null);
              setCreating(createBlankInterview());
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New interview
          </Button>
        }
      />
      <InterviewError
        error={catalogQuery.error}
        retry={() => void catalogQuery.refetch()}
      />
      <TutorEntityToolbar
        pageKey={'interview_bank'}
        defaultSettings={tutorDefaultDisplaySettings(table.state.defaultVisibleColumns ?? [])}
        state={table.state}
        onSearchChange={table.actions.onSearchChange}
        onFiltersChange={table.actions.onFiltersChange}
        onSortChange={table.actions.onSortChange}
        onGroupByChange={table.actions.onGroupByChange}
        onVisibleColumnsChange={table.actions.onVisibleColumnsChange}
        onQuickFilterApply={table.actions.onQuickFilterApply}
        onReset={table.actions.onReset}
        columnDefinitions={columnDefinitions}
        sortOptions={sortOptions}
        searchPlaceholder="Search interviews"
        {...tutorToolbarProps}
      />
      {!catalog && catalogQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Loading interviews…</p>
      ) : paged.total === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {catalog?.interviews.some((interview) => !interview.archived)
            ? "No interviews match this search."
            : "No interviews yet. Create one to start building your stations."}
        </p>
      ) : (
        <>
          <DataTable
            {...tutorDataTableProps}
            pagination="external"
            columns={[
              ...(visible.has("name")
                ? [
                    {
                      id: "name",
                      header: "Interview",
                      cell: ({ row }: { row: { original: InterviewTemplate } }) => (
                        <span className="font-medium">{row.original.name}</span>
                      ),
                    },
                  ]
                : []),
              ...(visible.has("stations")
                ? [
                    {
                      id: "stations",
                      header: "Stations",
                      cell: ({ row }: { row: { original: InterviewTemplate } }) =>
                        row.original.stations.length,
                    },
                  ]
                : []),
              ...(visible.has("questions")
                ? [
                    {
                      id: "questions",
                      header: "Questions",
                      cell: ({ row }: { row: { original: InterviewTemplate } }) =>
                        questionCount(row.original, catalog?.stations ?? []),
                    },
                  ]
                : []),
              ...(visible.has("timing")
                ? [
                    {
                      id: "timing",
                      header: "Reading / answer",
                      cell: ({ row }: { row: { original: InterviewTemplate } }) =>
                        `${formatMinutes(row.original.readingTimeSeconds)} / ${formatMinutes(row.original.questionTimeSeconds)}`,
                    },
                  ]
                : []),
              ...(visible.has("points")
                ? [
                    {
                      id: "points",
                      header: "Total points",
                      cell: ({ row }: { row: { original: InterviewTemplate } }) =>
                        totalPoints(row.original, catalog?.stations ?? []),
                    },
                  ]
                : []),
              ...(visible.has("updated")
                ? [
                    {
                      id: "updated",
                      header: "Updated",
                      cell: ({ row }: { row: { original: InterviewTemplate } }) =>
                        row.original.updatedAt
                          ? new Date(row.original.updatedAt).toLocaleString()
                          : "—",
                    },
                  ]
                : []),
              {
                id: "actions",
                header: "Actions",
                cell: ({ row }: { row: { original: InterviewTemplate } }) => (
                  <div className="flex justify-end">
                    <UcatRowActions
                      actions={[
                        {
                          label: "Edit",
                          icon: <Pencil className="h-4 w-4" />,
                          onClick: () => {
                            setCreating(null);
                            setEditingId(row.original.id);
                          },
                        },
                        {
                          label: "Print prompts",
                          icon: <Printer className="h-4 w-4" />,
                          onClick: () => setPrinting(row.original),
                        },
                      ]}
                    />
                  </div>
                ),
              },
            ]}
            data={paged.rows}
          />
          <TablePagination
            page={paged.page}
            pageSize={table.state.pageSize}
            total={paged.total}
            onPageChange={table.actions.onPageChange}
            onPageSizeChange={table.actions.onPageSizeChange}
            pageSizeOptions={[10, 20, 50]}
            className="pt-3"
          />
        </>
      )}
      {catalog ? (
        <InterviewPrintDialog
          interview={printing}
          catalog={catalog}
          onClose={() => setPrinting(null)}
        />
      ) : null}
      {catalog ? (
        <InterviewEditorDialog
          original={dialogInterview}
          catalog={catalog}
          mode={creating ? "create" : "edit"}
          onClose={() => {
            setCreating(null);
            setEditingId(null);
          }}
          onSaved={(id) => {
            if (creating) {
              setCreating(null);
              setEditingId(id);
            }
          }}
        />
      ) : null}
    </div>
  );
}
