"use client";
import { TutorEntityToolbar } from '@/features/quick-filters/components/TutorEntityToolbar'
import { tutorDefaultDisplaySettings } from '@altitutor/shared'

import { useMemo, useState } from "react";
import {
  Button,
  DataTable,
  TablePagination,
} from "@altitutor/ui";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import {
  interviewText,
  type DataTableColumnDefinition,
  type DataTableFilterDefinition,
  type DataTableSortOption,
  type InterviewStation,
} from "@altitutor/shared";
import { Archive, Copy, Pencil, Plus, RotateCcw, Upload } from "lucide-react";
import { UcatRowActions } from "@/features/ucat/shared/row-actions";
import {
  tutorBtnPrimary,
  tutorDataTableProps,
  tutorToolbarProps,
} from "@/shared/lib/tutor-visual";
import {
  useInterviewCatalog,
  useInterviewCommand,
} from "../hooks/use-interviews";
import { InterviewError } from "./interview-ui";
import { InterviewStationEditor } from "./InterviewStationEditor";
import { InterviewStationImport } from "./InterviewStationImport";
import { blankStation, duplicateStation } from "../lib/station-draft";
import { InterviewPageHeader, interviewCrumbs } from "./interview-page";
import {
  matchesMulti,
  pageRows,
  sortRows,
  useInterviewTable,
} from "./interview-table";

const columns: DataTableColumnDefinition[] = [
  { key: "name", label: "Station", visibleByDefault: true },
  { key: "prompt", label: "Prompt", visibleByDefault: true },
  { key: "questions", label: "Questions", visibleByDefault: true },
  { key: "category", label: "Category", visibleByDefault: true },
  { key: "questionCount", label: "Questions (number)", visibleByDefault: false },
  { key: "points", label: "Maximum score", visibleByDefault: true },
  { key: "updated", label: "Updated", visibleByDefault: false },
];
const sorts: DataTableSortOption[] = [
  { key: "updated", label: "Updated" },
  { key: "name", label: "Name" },
];
export function InterviewStationBank() {
  const query = useInterviewCatalog();
  const catalog = query.data;
  const command = useInterviewCommand();
  const table = useInterviewTable(
    columns.filter((c) => c.visibleByDefault).map((c) => c.key),
    { status: ["active"] },
  );
  const [importing, setImporting] = useState(false);
  const [editing, setEditing] = useState<InterviewStation | null>(null);
  const filters: DataTableFilterDefinition[] = useMemo(
    () => [
      {
        key: "category",
        label: "Station category",
        options: (catalog?.categories ?? []).map((c) => ({
          label: c.name,
          value: c.id,
        })),
      },
      {
        key: "tag",
        label: "Question tag",
        options: (catalog?.tags ?? []).map((t) => ({
          label: t.name,
          value: t.id,
        })),
      },
      {
        key: "status",
        label: "Status",
        options: [
          { label: "Active", value: "active" },
          { label: "Archived", value: "archived" },
        ],
      },
    ],
    [catalog?.categories, catalog?.tags],
  );
  const rows = useMemo(() => {
    const search = table.state.search.trim().toLowerCase();
    const selectedTags = (table.state.filters.tag ?? []).map(String);
    return sortRows(
      (catalog?.stations ?? []).filter(
        (station) =>
          matchesMulti(
            table.state.filters,
            "status",
            station.archived ? "archived" : "active",
          ) &&
          matchesMulti(table.state.filters, "category", station.categoryId) &&
          (!selectedTags.length ||
            station.questions.some((q) =>
              selectedTags.some((id) => q.tagIds.includes(id)),
            )) &&
          (!search ||
            [
              station.name,
              interviewText(station.prompt),
              ...station.questions.flatMap((q) => [
                interviewText(q.question),
                interviewText(q.rubric),
              ]),
            ].some((text) => text.toLowerCase().includes(search))),
      ),
      table.state,
      "updated",
      { updated: (s) => s.updatedAt, name: (s) => s.name },
    );
  }, [catalog?.stations, table.state]);
  const paged = pageRows(rows, table.state.page, table.state.pageSize);
  const visible = new Set(table.state.visibleColumns);
  return (
    <div className="space-y-6 py-8 md:py-10">
      <InterviewPageHeader
        title="Station bank"
        backHref="/interviews"
        backLabel="Back to interviews"
        breadcrumbs={interviewCrumbs("Station bank")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={!catalog}
              onClick={() => setImporting(true)}
            >
              <Upload className="mr-2 h-4 w-4" />
              Import station
            </Button>
            <Button
              className={tutorBtnPrimary}
              disabled={!catalog}
              onClick={() => {
                if (catalog)
                  setEditing(blankStation(catalog.categories[0]?.id ?? ""));
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New station
            </Button>
          </div>
        }
      />
      <InterviewError
        error={query.error ?? command.error}
        retry={() => void query.refetch()}
      />
      <TutorEntityToolbar
        pageKey={'interview_stations'}
        defaultViewName="Active"
        defaultSettings={tutorDefaultDisplaySettings(table.state.defaultVisibleColumns ?? [], { filters: { status: ['active'] } })}
        state={table.state}
        onSearchChange={table.actions.onSearchChange}
        onFiltersChange={table.actions.onFiltersChange}
        onSortChange={table.actions.onSortChange}
        onGroupByChange={table.actions.onGroupByChange}
        onVisibleColumnsChange={table.actions.onVisibleColumnsChange}
        onQuickFilterApply={table.actions.onQuickFilterApply}
        onReset={table.actions.onReset}
        filterDefinitions={filters}
        columnDefinitions={columns}
        sortOptions={sorts}
        searchPlaceholder="Search stations, prompts, questions and rubrics"
        {...tutorToolbarProps}
      />
      {!catalog ? (
        <p>Loading station bank…</p>
      ) : !paged.total ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {catalog.stations.length
            ? "No stations match these filters."
            : "No stations yet. Add a category, then create your first station."}
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
                      header: "Station",
                      cell: ({
                        row,
                      }: {
                        row: { original: InterviewStation };
                      }) => (
                        <span className="font-medium">{row.original.name}</span>
                      ),
                    },
                  ]
                : []),
              ...(visible.has("prompt")
                ? [
                    {
                      id: "prompt",
                      header: "Prompt",
                      cell: ({
                        row,
                      }: {
                        row: { original: InterviewStation };
                      }) => (
                        <p className="line-clamp-2 max-w-xl">
                          {interviewText(row.original.prompt)}
                        </p>
                      ),
                    },
                  ]
                : []),
              ...(visible.has("questions")
                ? [
                    {
                      id: "questions",
                      header: "Questions",
                      cell: ({
                        row,
                      }: {
                        row: { original: InterviewStation };
                      }) => (
                        <div className="max-w-xl space-y-1">
                          {row.original.questions.map((question, index) => (
                            <p key={question.id}>
                              {index + 1}. {interviewText(question.question)}
                            </p>
                          ))}
                        </div>
                      ),
                    },
                  ]
                : []),
              ...(visible.has("category")
                ? [
                    {
                      id: "category",
                      header: "Category",
                      cell: ({
                        row,
                      }: {
                        row: { original: InterviewStation };
                      }) =>
                        catalog.categories.find(
                          (c) => c.id === row.original.categoryId,
                        )?.name ?? "—",
                    },
                  ]
                : []),
              ...(visible.has("questionCount")
                ? [
                    {
                      id: "questionCount",
                      header: "Questions (number)",
                      cell: ({
                        row,
                      }: {
                        row: { original: InterviewStation };
                      }) => row.original.questions.length,
                    },
                  ]
                : []),
              ...(visible.has("points")
                ? [
                    {
                      id: "points",
                      header: "Maximum score",
                      cell: ({
                        row,
                      }: {
                        row: { original: InterviewStation };
                      }) => row.original.maximumPoints,
                    },
                  ]
                : []),
              ...(visible.has("updated")
                ? [
                    {
                      id: "updated",
                      header: "Updated",
                      cell: ({
                        row,
                      }: {
                        row: { original: InterviewStation };
                      }) => new Date(row.original.updatedAt).toLocaleString(),
                    },
                  ]
                : []),
              {
                id: "actions",
                header: "Actions",
                cell: ({ row }: { row: { original: InterviewStation } }) => (
                  <div className="flex justify-end">
                    <UcatRowActions
                      actions={[
                        {
                          label: "Edit",
                          icon: <Pencil className="h-4 w-4" />,
                          onClick: () => setEditing(row.original),
                        },
                        {
                          label: "Duplicate",
                          icon: <Copy className="h-4 w-4" />,
                          onClick: () =>
                            setEditing(duplicateStation(row.original)),
                        },
                        {
                          label: row.original.archived ? "Restore" : "Archive",
                          icon: row.original.archived ? (
                            <RotateCcw className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          ),
                          onClick: () =>
                            command.mutate({
                              type: "saveStation",
                              commandId: randomUuid(),
                              expectedVersion: row.original.version,
                              station: {
                                ...row.original,
                                archived: !row.original.archived,
                              },
                            }),
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
      {importing && catalog && (
        <InterviewStationImport
          catalog={catalog}
          close={() => setImporting(false)}
        />
      )}
      {editing && catalog && (
        <InterviewStationEditor
          key={editing.id}
          station={editing}
          catalog={catalog}
          close={() => setEditing(null)}
        />
      )}
    </div>
  );
}
