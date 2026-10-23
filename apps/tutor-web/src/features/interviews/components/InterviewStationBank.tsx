"use client";

import { useMemo, useState } from "react";
import {
  Button,
  DataTable,
  DataTableToolbar,
  Input,
  TablePagination,
  type JSONContent,
} from "@altitutor/ui";
import {
  interviewText,
  type DataTableColumnDefinition,
  type DataTableFilterDefinition,
  type DataTableSortOption,
  type InterviewCatalog,
  type InterviewQuestion,
  type InterviewStation,
} from "@altitutor/shared";
import { Archive, Copy, Pencil, Plus, RotateCcw } from "lucide-react";
import { UcatDialogShell } from "@/features/ucat/shared/dialog-shell";
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
import {
  InterviewDocument,
  InterviewError,
  InterviewField,
  InterviewSelect,
  emptyDocument,
} from "./interview-ui";
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
  { key: "category", label: "Category", visibleByDefault: true },
  { key: "questions", label: "Questions", visibleByDefault: true },
  { key: "points", label: "Maximum score", visibleByDefault: true },
  { key: "updated", label: "Updated", visibleByDefault: false },
];
const sorts: DataTableSortOption[] = [
  { key: "updated", label: "Updated" },
  { key: "name", label: "Name" },
];
function blankQuestion(stationId: string): InterviewQuestion {
  return {
    id: crypto.randomUUID(),
    stationId,
    tagIds: [],
    question: emptyDocument,
    rubric: emptyDocument,
    rubricVersion: 0,
    suggestedTimeSeconds: 60,
  };
}
function blankStation(categoryId: string): InterviewStation {
  const id = crypto.randomUUID();
  return {
    id,
    version: 0,
    name: "",
    categoryId,
    prompt: emptyDocument,
    maximumPoints: 6,
    questions: [blankQuestion(id)],
    archived: false,
    updatedAt: "",
  };
}
function duplicateStation(original: InterviewStation): InterviewStation {
  const id = crypto.randomUUID();
  return {
    ...original,
    id,
    version: 0,
    name: `${original.name} (copy)`,
    archived: false,
    updatedAt: "",
    questions: original.questions.map((q) => ({
      ...q,
      id: crypto.randomUUID(),
      stationId: id,
      rubricVersion: 0,
    })),
  };
}

function StationEditor({
  station,
  catalog,
  close,
}: {
  station: InterviewStation;
  catalog: InterviewCatalog;
  close: () => void;
}) {
  const [draft, setDraft] = useState(station);
  const [baseVersion] = useState(station.version);
  const command = useInterviewCommand();
  const updateQuestion = (question: InterviewQuestion) =>
    setDraft((previous) => ({
      ...previous,
      questions: previous.questions.map((q) =>
        q.id === question.id ? question : q,
      ),
    }));
  const moveQuestion = (index: number, offset: number) =>
    setDraft((previous) => {
      const questions = [...previous.questions];
      [questions[index], questions[index + offset]] = [
        questions[index + offset],
        questions[index],
      ];
      return { ...previous, questions };
    });
  const save = async () => {
    await command.mutateAsync({
      type: "saveStation",
      commandId: crypto.randomUUID(),
      expectedVersion: baseVersion,
      station: draft,
    });
    close();
  };
  const usedBy = catalog.interviews.filter((interview) =>
    interview.stations.some((p) => p.stationId === station.id),
  );
  return (
    <UcatDialogShell
      open
      onClose={() => {
        if (
          !command.isPending &&
          (draft === station ||
            window.confirm("Discard unsaved station changes?"))
        )
          close();
      }}
      title={baseVersion ? "Edit station" : "New station"}
      subtitle="Edit the whole station here. Changes update prepared interviews; started rounds keep their wording. Rubric corrections also reach active rounds."
      onSave={() => void save().catch(() => undefined)}
      saveLabel="Save station"
      isSaving={command.isPending}
      saveDisabled={
        command.isPending ||
        !draft.name.trim() ||
        !draft.categoryId ||
        !interviewText(draft.prompt).trim() ||
        draft.maximumPoints <= 0 ||
        draft.maximumPoints > 1000 ||
        draft.questions.some(
          (q) =>
            !interviewText(q.question).trim() ||
            !Number.isInteger(q.suggestedTimeSeconds) ||
            q.suggestedTimeSeconds < 1 ||
            q.suggestedTimeSeconds > 7200,
        )
      }
      defaultExpanded
    >
      <div className="h-full space-y-5 overflow-y-auto p-6">
        <InterviewError error={command.error} />
        {usedBy.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Used in: {usedBy.map((i) => i.name).join(", ")}. Duplicate this
            station to create an independent variant.
          </p>
        )}
        <InterviewField label="Station name">
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
        </InterviewField>
        <InterviewField label="Category">
          <InterviewSelect
            label="Category"
            value={draft.categoryId}
            options={catalog.categories.map((c) => ({
              id: c.id,
              label: c.name,
            }))}
            onChange={(id) => setDraft({ ...draft, categoryId: id ?? "" })}
          />
        </InterviewField>
        <InterviewField label="Reading prompt">
          <InterviewDocument
            value={draft.prompt as JSONContent}
            onChange={(prompt) => setDraft({ ...draft, prompt })}
          />
        </InterviewField>
        <InterviewField label="Maximum station score">
          <Input
            type="number"
            min={0.01}
            max={1000}
            step="any"
            value={draft.maximumPoints}
            onChange={(e) =>
              setDraft({ ...draft, maximumPoints: Number(e.target.value) })
            }
          />
        </InterviewField>
        {draft.questions.map((question, index) => (
          <section
            key={question.id}
            className="space-y-4 rounded-lg border p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Question {index + 1}</h3>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Move question ${index + 1} up`}
                  disabled={index === 0}
                  onClick={() => moveQuestion(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Move question ${index + 1} down`}
                  disabled={index === draft.questions.length - 1}
                  onClick={() => moveQuestion(index, 1)}
                >
                  ↓
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={draft.questions.length === 1}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      questions: draft.questions.filter(
                        (q) => q.id !== question.id,
                      ),
                    })
                  }
                >
                  Remove
                </Button>
              </div>
            </div>
            <InterviewField label="Question">
              <InterviewDocument
                value={question.question as JSONContent}
                onChange={(value) =>
                  updateQuestion({ ...question, question: value })
                }
              />
            </InterviewField>
            <InterviewField label="Question tags">
              <div className="mb-2 flex flex-wrap gap-2">
                {question.tagIds.map((id) => (
                  <Button
                    key={id}
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      updateQuestion({
                        ...question,
                        tagIds: question.tagIds.filter((tag) => tag !== id),
                      })
                    }
                  >
                    {catalog.tags.find((t) => t.id === id)?.name} ×
                  </Button>
                ))}
              </div>
              <InterviewSelect
                label="Add question tag"
                value={null}
                options={catalog.tags
                  .filter((t) => !question.tagIds.includes(t.id))
                  .map((t) => ({ id: t.id, label: t.name }))}
                onChange={(id) => {
                  if (id)
                    updateQuestion({
                      ...question,
                      tagIds: [...question.tagIds, id],
                    });
                }}
              />
            </InterviewField>
            <InterviewField label="Rubric">
              <InterviewDocument
                value={question.rubric as JSONContent}
                onChange={(rubric) => updateQuestion({ ...question, rubric })}
              />
            </InterviewField>
            <InterviewField label="Recommended answer time (seconds)">
              <Input
                type="number"
                min={1}
                max={7200}
                value={question.suggestedTimeSeconds}
                onChange={(e) =>
                  updateQuestion({
                    ...question,
                    suggestedTimeSeconds: Number(e.target.value),
                  })
                }
              />
            </InterviewField>
          </section>
        ))}
        <Button
          variant="outline"
          disabled={draft.questions.length >= 100}
          onClick={() =>
            setDraft({
              ...draft,
              questions: [...draft.questions, blankQuestion(draft.id)],
            })
          }
        >
          Add question
        </Button>
      </div>
    </UcatDialogShell>
  );
}

export function InterviewStationBank() {
  const query = useInterviewCatalog();
  const catalog = query.data;
  const command = useInterviewCommand();
  const table = useInterviewTable(
    columns.filter((c) => c.visibleByDefault).map((c) => c.key),
    { status: ["active"] },
  );
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
        }
      />
      <InterviewError
        error={query.error ?? command.error}
        retry={() => void query.refetch()}
      />
      <DataTableToolbar
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
        viewTarget="interview_stations"
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
              ...(visible.has("questions")
                ? [
                    {
                      id: "questions",
                      header: "Questions",
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
                              commandId: crypto.randomUUID(),
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
      {editing && catalog && (
        <StationEditor
          key={editing.id}
          station={editing}
          catalog={catalog}
          close={() => setEditing(null)}
        />
      )}
    </div>
  );
}
