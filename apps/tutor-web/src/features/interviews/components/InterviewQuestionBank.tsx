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
import type {
  DataTableColumnDefinition,
  DataTableFilterDefinition,
  DataTableSortOption,
  InterviewCatalog,
  InterviewQuestion,
  InterviewRichText,
} from "@altitutor/shared";
import { interviewText } from "@altitutor/shared";
import { Archive, Pencil, Plus, RotateCcw } from "lucide-react";
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

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: "prompt", label: "Prompt", visibleByDefault: true },
  { key: "question", label: "Question", visibleByDefault: true },
  { key: "category", label: "Category", visibleByDefault: true },
  { key: "tags", label: "Tags", visibleByDefault: true },
  { key: "time", label: "Suggested time", visibleByDefault: true },
  { key: "updated", label: "Updated", visibleByDefault: false },
];

const sortOptions: DataTableSortOption[] = [
  { key: "updated", label: "Updated" },
  { key: "question", label: "Question" },
  { key: "time", label: "Suggested time" },
];

function blankQuestion(categoryId: string): InterviewQuestion {
  return {
    id: crypto.randomUUID(),
    version: 0,
    categoryId,
    tagIds: [],
    question: emptyDocument as InterviewRichText,
    prompt: emptyDocument as InterviewRichText,
    rubric: emptyDocument as InterviewRichText,
    rubricVersion: 0,
    suggestedTimeSeconds: 60,
    archived: false,
    updatedAt: "",
  };
}

function QuestionEditor({
  question,
  catalog,
  close,
}: {
  question: InterviewQuestion;
  catalog: InterviewCatalog;
  close: () => void;
}) {
  const [draft, setDraft] = useState(question);
  const command = useInterviewCommand();
  const save = async () => {
    await command.mutateAsync({
      type: "saveQuestion",
      commandId: crypto.randomUUID(),
      expectedVersion: question.version,
      question: draft,
    });
    close();
  };
  return (
    <UcatDialogShell
      open
      onClose={() => {
        if (!command.isPending) close();
      }}
      title={question.version ? "Edit question" : "New question"}
      subtitle="Wording updates every prepared interview. Active rounds retain their question wording; rubric changes apply to active rounds too."
      onSave={() => void save().catch(() => undefined)}
      saveLabel="Save question"
      saveDisabled={
        command.isPending ||
        !draft.categoryId ||
        !interviewText(draft.question).trim()
      }
      isSaving={command.isPending}
      defaultExpanded
    >
      <div className="h-full space-y-5 overflow-y-auto p-6">
        <InterviewError error={command.error} />
        <InterviewField label="Category">
          <InterviewSelect
            label="Category"
            options={catalog.categories.map((item) => ({
              id: item.id,
              label: item.name,
            }))}
            value={draft.categoryId}
            onChange={(value) =>
              setDraft({ ...draft, categoryId: value ?? "" })
            }
          />
        </InterviewField>
        <InterviewField label="Tags">
          <div className="flex flex-wrap gap-2">
            {draft.tagIds.map((id) => (
              <Button
                key={id}
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft({
                    ...draft,
                    tagIds: draft.tagIds.filter((tagId) => tagId !== id),
                  })
                }
              >
                {catalog.tags.find((tag) => tag.id === id)?.name} ×
              </Button>
            ))}
          </div>
          <InterviewSelect
            label="Add tag"
            value={null}
            options={catalog.tags
              .filter((tag) => !draft.tagIds.includes(tag.id))
              .map((tag) => ({ id: tag.id, label: tag.name }))}
            onChange={(id) => {
              if (id) setDraft({ ...draft, tagIds: [...draft.tagIds, id] });
            }}
          />
        </InterviewField>
        {(["question", "prompt", "rubric"] as const).map((field) => (
          <InterviewField
            key={field}
            label={
              field === "question"
                ? "Question"
                : field === "prompt"
                  ? "Reading prompt"
                  : "Rubric"
            }
          >
            <InterviewDocument
              value={draft[field] as JSONContent}
              onChange={(value) =>
                setDraft({ ...draft, [field]: value as InterviewRichText })
              }
            />
          </InterviewField>
        ))}
        <InterviewField label="Suggested answer time (seconds)">
          <Input
            type="number"
            min={0}
            value={draft.suggestedTimeSeconds}
            onChange={(event) =>
              setDraft({
                ...draft,
                suggestedTimeSeconds: Number(event.target.value),
              })
            }
          />
        </InterviewField>
      </div>
    </UcatDialogShell>
  );
}

const activeQuestionsFilter = { status: ["active"] };

export function InterviewQuestionBank() {
  const catalogQuery = useInterviewCatalog();
  const catalog = catalogQuery.data;
  const command = useInterviewCommand();
  const table = useInterviewTable(
    columnDefinitions
      .filter((column) => column.visibleByDefault)
      .map((column) => column.key),
    activeQuestionsFilter,
  );
  const [editing, setEditing] = useState<InterviewQuestion | null>(null);

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(
    () => [
      {
        key: "category",
        label: "Category",
        options: (catalog?.categories ?? []).map((item) => ({
          label: item.name,
          value: item.id,
        })),
      },
      {
        key: "tag",
        label: "Tag",
        options: (catalog?.tags ?? []).map((item) => ({
          label: item.name,
          value: item.id,
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

  const questions = useMemo(() => {
    const rows = (catalog?.questions ?? []).filter((question) => {
      const status = question.archived ? "archived" : "active";
      const tagMatches = (() => {
        const selected = (table.state.filters.tag ?? []).map(String);
        if (!selected.length) return true;
        return selected.some((id) => question.tagIds.includes(id));
      })();
      const query = table.state.search.trim().toLowerCase();
      const textMatches =
        !query ||
        [question.question, question.prompt, question.rubric].some((value) =>
          interviewText(value).toLowerCase().includes(query),
        );
      return (
        tagMatches &&
        textMatches &&
        matchesMulti(table.state.filters, "status", status) &&
        matchesMulti(table.state.filters, "category", question.categoryId)
      );
    });
    return sortRows(rows, table.state, "updated", {
      updated: (question) => question.updatedAt,
      question: (question) => interviewText(question.question),
      time: (question) => question.suggestedTimeSeconds,
    });
  }, [catalog?.questions, table.state]);

  const paged = pageRows(questions, table.state.page, table.state.pageSize);
  const visible = new Set(table.state.visibleColumns);

  if (!catalog) {
    return (
      <div className="space-y-6 py-8 md:py-10">
        <InterviewPageHeader
          title="Question bank"
          backHref="/interviews"
          backLabel="Back to interviews"
          breadcrumbs={interviewCrumbs("Question bank")}
        />
        <InterviewError
          error={catalogQuery.error}
          retry={() => void catalogQuery.refetch()}
        />
        {catalogQuery.isPending ? <p>Loading question bank…</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6 py-8 md:py-10">
      <InterviewPageHeader
        title="Question bank"
        backHref="/interviews"
        backLabel="Back to interviews"
        breadcrumbs={interviewCrumbs("Question bank")}
        actions={
          <Button
            className={tutorBtnPrimary}
            onClick={() =>
              setEditing(
                blankQuestion(catalog.categories[0]?.id ?? ""),
              )
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            New question
          </Button>
        }
      />
      <InterviewError error={command.error} />
      <DataTableToolbar
        state={table.state}
        onSearchChange={table.actions.onSearchChange}
        onFiltersChange={table.actions.onFiltersChange}
        onSortChange={table.actions.onSortChange}
        onGroupByChange={table.actions.onGroupByChange}
        onVisibleColumnsChange={table.actions.onVisibleColumnsChange}
        onQuickFilterApply={table.actions.onQuickFilterApply}
        onReset={table.actions.onReset}
        filterDefinitions={filterDefinitions}
        columnDefinitions={columnDefinitions}
        sortOptions={sortOptions}
        searchPlaceholder="Search questions, prompts and rubrics"
        viewTarget="interview_questions"
        {...tutorToolbarProps}
      />
      {paged.total === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {catalog.questions.length
            ? "No questions match these filters."
            : "No questions yet. Add a category, then create your first question."}
        </p>
      ) : (
        <>
          <DataTable
            {...tutorDataTableProps}
            pagination="external"
            columns={[
              ...(visible.has("prompt")
                ? [
                    {
                      id: "prompt",
                      header: "Prompt",
                      cell: ({ row }: { row: { original: InterviewQuestion } }) => (
                        <p className="line-clamp-2 max-w-xl">
                          {interviewText(row.original.prompt) || "—"}
                        </p>
                      ),
                    },
                  ]
                : []),
              ...(visible.has("question")
                ? [
                    {
                      id: "question",
                      header: "Question",
                      cell: ({ row }: { row: { original: InterviewQuestion } }) => (
                        <p className="line-clamp-2 max-w-xl font-medium">
                          {interviewText(row.original.question) || "Untitled question"}
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
                      cell: ({ row }: { row: { original: InterviewQuestion } }) =>
                        catalog.categories.find(
                          (item) => item.id === row.original.categoryId,
                        )?.name ?? "—",
                    },
                  ]
                : []),
              ...(visible.has("tags")
                ? [
                    {
                      id: "tags",
                      header: "Tags",
                      cell: ({ row }: { row: { original: InterviewQuestion } }) => {
                        const names = row.original.tagIds
                          .map(
                            (id) => catalog.tags.find((tag) => tag.id === id)?.name,
                          )
                          .filter(Boolean);
                        return names.length ? names.join(", ") : "—";
                      },
                    },
                  ]
                : []),
              ...(visible.has("time")
                ? [
                    {
                      id: "time",
                      header: "Suggested time",
                      cell: ({ row }: { row: { original: InterviewQuestion } }) =>
                        `${row.original.suggestedTimeSeconds}s`,
                    },
                  ]
                : []),
              ...(visible.has("updated")
                ? [
                    {
                      id: "updated",
                      header: "Updated",
                      cell: ({ row }: { row: { original: InterviewQuestion } }) =>
                        row.original.updatedAt
                          ? new Date(row.original.updatedAt).toLocaleString()
                          : "—",
                    },
                  ]
                : []),
              {
                id: "actions",
                header: "Actions",
                cell: ({ row }: { row: { original: InterviewQuestion } }) => (
                  <div className="flex justify-end" onClick={(event) => event.stopPropagation()}>
                    <UcatRowActions
                      actions={[
                        {
                          label: "Edit",
                          icon: <Pencil className="h-4 w-4" />,
                          onClick: () => setEditing(row.original),
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
                              type: "saveQuestion",
                              commandId: crypto.randomUUID(),
                              expectedVersion: row.original.version,
                              question: {
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
      {editing ? (
        <QuestionEditor
          key={editing.id}
          question={editing}
          catalog={catalog}
          close={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
