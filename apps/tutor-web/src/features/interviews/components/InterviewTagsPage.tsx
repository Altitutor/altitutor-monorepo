"use client";

import { useMemo, useState } from "react";
import { Button, DataTableToolbar, Input } from "@altitutor/ui";
import type { DataTableSortOption, InterviewTag } from "@altitutor/shared";
import { Plus } from "lucide-react";
import { UcatDialogShell } from "@/features/ucat/shared/dialog-shell";
import { tutorBtnPrimary, tutorCardCn, tutorToolbarProps } from "@/shared/lib/tutor-visual";
import {
  useInterviewCatalog,
  useInterviewCommand,
} from "../hooks/use-interviews";
import { InterviewError, InterviewField } from "./interview-ui";
import { InterviewPageHeader, interviewCrumbs } from "./interview-page";
import { sortRows, useInterviewTable } from "./interview-table";

const sortOptions: DataTableSortOption[] = [
  { key: "name", label: "Name" },
  { key: "questions", label: "Questions" },
];

export function InterviewTagsPage() {
  const catalogQuery = useInterviewCatalog();
  const catalog = catalogQuery.data;
  const command = useInterviewCommand();
  const table = useInterviewTable(["name", "questions"]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<InterviewTag | null>(null);
  const [name, setName] = useState("");

  const questionCount = (id: string) =>
    (catalog?.questions ?? []).filter(
      (question) => !question.archived && question.tagIds.includes(id),
    ).length;

  const tags = useMemo(() => {
    const query = table.state.search.trim().toLowerCase();
    const counts = new Map(
      (catalog?.tags ?? []).map((tag) => [
        tag.id,
        (catalog?.questions ?? []).filter(
          (question) => !question.archived && question.tagIds.includes(tag.id),
        ).length,
      ]),
    );
    const rows = (catalog?.tags ?? []).filter(
      (tag) => !query || tag.name.toLowerCase().includes(query),
    );
    return sortRows(rows, table.state, "name", {
      name: (tag) => tag.name,
      questions: (tag) => counts.get(tag.id) ?? 0,
    });
  }, [catalog?.questions, catalog?.tags, table.state]);

  const showQuestionCount = table.state.visibleColumns.includes("questions");

  const save = async () => {
    const id = editing?.id ?? crypto.randomUUID();
    await command.mutateAsync({
      type: "saveTag",
      commandId: crypto.randomUUID(),
      tag: { id, name: name.trim() },
    });
    setCreating(false);
    setEditing(null);
    setName("");
  };

  return (
    <div className="space-y-6 py-8 md:py-10">
      <InterviewPageHeader
        title="Question tags"
        backHref="/interviews"
        backLabel="Back to interviews"
        breadcrumbs={interviewCrumbs("Question tags")}
        actions={
          <Button
            className={tutorBtnPrimary}
            onClick={() => {
              setEditing(null);
              setName("");
              setCreating(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add tag
          </Button>
        }
      />
      <InterviewError
        error={catalogQuery.error}
        retry={() => void catalogQuery.refetch()}
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
        columnDefinitions={[
          { key: "name", label: "Tag", visibleByDefault: true },
          { key: "questions", label: "Questions", visibleByDefault: true },
        ]}
        sortOptions={sortOptions}
        searchPlaceholder="Search tags"
        viewTarget="interview_tags"
        {...tutorToolbarProps}
      />
      {!catalog && catalogQuery.isPending ? (
        <p className="text-sm text-muted-foreground">Loading tags…</p>
      ) : tags.length === 0 ? (
        <div className={tutorCardCn("p-6 text-center text-sm text-muted-foreground")}>
          {catalog?.tags.length ? "No tags match this search." : "No tags yet."}
        </div>
      ) : (
        <section className="rounded-xl border border-border bg-card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold tracking-tight">Tags</h2>
          <ul className="space-y-1">
            {tags.map((tag) => {
              const count = questionCount(tag.id);
              return (
                <li key={tag.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setEditing(tag);
                      setName(tag.name);
                    }}
                    className="flex w-full items-center rounded-lg px-2 py-2 text-left hover:bg-muted/60"
                  >
                    <span className="font-medium">{tag.name}</span>
                    {showQuestionCount ? (
                      <span className="ml-2 text-xs font-medium tabular-nums text-muted-foreground">
                        {count} {count === 1 ? "question" : "questions"}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <UcatDialogShell
        open={creating || !!editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
          setName("");
        }}
        title={editing ? "Edit tag" : "Create tag"}
        subtitle="Tags label shared interview questions."
        onSave={() => void save().catch(() => undefined)}
        saveLabel={editing ? "Save" : "Create"}
        saveDisabled={!name.trim() || command.isPending}
        isSaving={command.isPending}
      >
        <div className="h-full overflow-y-auto p-6">
          <InterviewField label="Name">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </InterviewField>
          <InterviewError error={command.error} />
        </div>
      </UcatDialogShell>
    </div>
  );
}
