"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  type JSONContent,
} from "@altitutor/ui";
import type {
  InterviewCatalog,
  InterviewQuestion,
  InterviewRichText,
} from "@altitutor/shared";
import { interviewText } from "@altitutor/shared";
import {
  useInterviewCatalog,
  useInterviewCommand,
} from "../hooks/use-interviews";
import {
  InterviewDocument,
  InterviewError,
  InterviewField,
  InterviewPanel,
  InterviewSearch,
  InterviewSelect,
  emptyDocument,
} from "./interview-ui";
import { tutorBtnOutline } from "@/shared/lib/tutor-visual";
import { cn } from "@/shared/utils";

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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !command.isPending) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {question.version ? "Edit shared question" : "New question"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Wording updates every prepared interview. Active rounds retain their
          question wording; rubric changes apply to active rounds too.
        </p>
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
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={
              command.isPending ||
              !draft.categoryId ||
              !interviewText(draft.question).trim()
            }
            onClick={() => void save().catch(() => undefined)}
          >
            Save question
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TaxonomyEditor({
  catalog,
  close,
}: {
  catalog: InterviewCatalog;
  close: () => void;
}) {
  const [kind, setKind] = useState("category");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const command = useInterviewCommand();
  const items = kind === "category" ? catalog.categories : catalog.tags;
  const save = async () => {
    const id = selectedId ?? crypto.randomUUID();
    await command.mutateAsync(
      kind === "category"
        ? {
            type: "saveCategory",
            commandId: crypto.randomUUID(),
            category: { id, name: name.trim(), parentId },
          }
        : {
            type: "saveTag",
            commandId: crypto.randomUUID(),
            tag: { id, name: name.trim() },
          },
    );
    setName("");
    setSelectedId(null);
    setParentId(null);
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Categories and tags</DialogTitle>
        </DialogHeader>
        <InterviewSelect
          label="Type"
          value={kind}
          options={[
            { id: "category", label: "Categories" },
            { id: "tag", label: "Tags" },
          ]}
          onChange={(value) => {
            setKind(value ?? "category");
            setSelectedId(null);
            setName("");
          }}
        />
        <InterviewSelect
          label="Edit existing or add new"
          value={selectedId}
          clear
          options={items.map((item) => ({ id: item.id, label: item.name }))}
          onChange={(id) => {
            setSelectedId(id);
            setName(items.find((item) => item.id === id)?.name ?? "");
            setParentId(
              catalog.categories.find((item) => item.id === id)?.parentId ??
                null,
            );
          }}
        />
        <InterviewField label="Name">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </InterviewField>
        {kind === "category" && (
          <InterviewSelect
            label="Parent category (optional)"
            clear
            value={parentId}
            options={catalog.categories
              .filter((category) => category.id !== selectedId)
              .map((category) => ({ id: category.id, label: category.name }))}
            onChange={setParentId}
          />
        )}
        <InterviewError error={command.error} />
        <Button
          disabled={!name.trim() || command.isPending}
          onClick={() => void save().catch(() => undefined)}
        >
          {selectedId ? "Save changes" : "Add"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function InterviewQuestionBank() {
  const catalogQuery = useInterviewCatalog();
  const catalog = catalogQuery.data;
  const command = useInterviewCommand();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState("updated");
  const [view, setView] = useState("detail");
  const [archived, setArchived] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<InterviewQuestion | null>(null);
  const [taxonomy, setTaxonomy] = useState(false);
  if (!catalog)
    return (
      <div className="py-8">
        <InterviewError
          error={catalogQuery.error}
          retry={() => void catalogQuery.refetch()}
        />
        {catalogQuery.isPending && "Loading question bank…"}
      </div>
    );
  const questions = catalog.questions
    .filter(
      (question) =>
        (archived || !question.archived) &&
        (!category || question.categoryId === category) &&
        (!tag || question.tagIds.includes(tag)) &&
        [question.question, question.prompt, question.rubric].some((value) =>
          interviewText(value).toLowerCase().includes(search.toLowerCase()),
        ),
    )
    .sort((a, b) =>
      sort === "name"
        ? interviewText(a.question).localeCompare(interviewText(b.question))
        : sort === "time"
          ? a.suggestedTimeSeconds - b.suggestedTimeSeconds
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  const selected =
    questions.find((question) => question.id === selectedId) ?? questions[0];
  const usages = selected
    ? catalog.interviews.flatMap((interview) =>
        interview.stations
          .filter((station) =>
            station.questions.some(
              (placement) => placement.questionId === selected.id,
            ),
          )
          .map((station) => ({ interview, station })),
      )
    : [];
  return (
    <div className="space-y-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Question bank</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Shared questions, reading prompts and marking guidance.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className={tutorBtnOutline}
            onClick={() => setTaxonomy(true)}
          >
            Categories and tags
          </Button>
          <Button
            onClick={() =>
              setEditing({
                id: crypto.randomUUID(),
                version: 0,
                categoryId: category ?? catalog.categories[0]?.id ?? "",
                tagIds: [],
                question: emptyDocument as InterviewRichText,
                prompt: emptyDocument as InterviewRichText,
                rubric: emptyDocument as InterviewRichText,
                rubricVersion: 0,
                suggestedTimeSeconds: 60,
                archived: false,
                updatedAt: "",
              })
            }
          >
            New question
          </Button>
        </div>
      </div>
      <InterviewError error={command.error} />
      <InterviewSearch
        value={search}
        onChange={setSearch}
        placeholder="Search questions, prompts and rubrics…"
      >
        <div className="w-40">
          <InterviewSelect
            label="View"
            value={view}
            options={[
              { id: "detail", label: "View: preview" },
              { id: "compact", label: "View: compact" },
            ]}
            onChange={(value) => setView(value ?? "detail")}
          />
        </div>
        <div className="w-44">
          <InterviewSelect
            label="Sort"
            value={sort}
            options={[
              { id: "updated", label: "Recently updated" },
              { id: "name", label: "Question text" },
              { id: "time", label: "Suggested time" },
            ]}
            onChange={(value) => setSort(value ?? "updated")}
          />
        </div>
        <div className="w-44">
          <InterviewSelect
            label="Filter category"
            clear
            value={category}
            options={catalog.categories.map((item) => ({
              id: item.id,
              label: item.name,
            }))}
            onChange={setCategory}
          />
        </div>
        <div className="w-40">
          <InterviewSelect
            label="Filter tag"
            clear
            value={tag}
            options={catalog.tags.map((item) => ({
              id: item.id,
              label: item.name,
            }))}
            onChange={setTag}
          />
        </div>
      </InterviewSearch>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={archived}
          onCheckedChange={(value) => setArchived(value === true)}
        />
        Show archived questions
      </label>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.2fr)]">
        <InterviewPanel title={`${questions.length} questions`} className="p-2">
          {questions.map((question) => (
            <button
              key={question.id}
              onClick={() => setSelectedId(question.id)}
              className={cn(
                "block w-full rounded-xl p-4 text-left hover:bg-muted/60",
                selected?.id === question.id && "bg-muted",
              )}
            >
              <p className="font-medium">{interviewText(question.question)}</p>
              {view === "detail" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {
                    catalog.categories.find(
                      (item) => item.id === question.categoryId,
                    )?.name
                  }{" "}
                  · {question.suggestedTimeSeconds}s
                </p>
              )}
              {question.archived && (
                <Badge variant="outline" className="mt-2">
                  Archived
                </Badge>
              )}
            </button>
          ))}
          {!questions.length && (
            <p className="p-4 text-sm text-muted-foreground">
              No questions match. Add a category and create your first question.
            </p>
          )}
        </InterviewPanel>
        {selected && (
          <InterviewPanel
            title="Question preview"
            action={
              <Button
                variant="outline"
                className={tutorBtnOutline}
                onClick={() => setEditing(selected)}
              >
                Edit
              </Button>
            }
          >
            <div className="space-y-5">
              <InterviewDocument value={selected.question as JSONContent} />
              <InterviewField label="Reading prompt">
                <InterviewDocument value={selected.prompt as JSONContent} />
              </InterviewField>
              <InterviewField label="Rubric">
                <InterviewDocument value={selected.rubric as JSONContent} />
              </InterviewField>
              <InterviewField label="Used in">
                {usages.length ? (
                  <div className="space-y-2">
                    {usages.map(({ interview, station }) => (
                      <Link
                        className="block text-sm underline"
                        key={`${interview.id}-${station.id}`}
                        href={`/interviews/${interview.id}?station=${station.id}`}
                      >
                        {interview.name} · {station.name}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Not used in a prepared interview.
                  </p>
                )}
              </InterviewField>
              <Button
                variant="outline"
                className={tutorBtnOutline}
                disabled={command.isPending}
                onClick={() =>
                  command.mutate({
                    type: "saveQuestion",
                    commandId: crypto.randomUUID(),
                    expectedVersion: selected.version,
                    question: { ...selected, archived: !selected.archived },
                  })
                }
              >
                {selected.archived ? "Restore question" : "Archive question"}
              </Button>
            </div>
          </InterviewPanel>
        )}
      </div>
      {editing && (
        <QuestionEditor
          question={editing}
          catalog={catalog}
          close={() => setEditing(null)}
        />
      )}
      {taxonomy && (
        <TaxonomyEditor catalog={catalog} close={() => setTaxonomy(false)} />
      )}
    </div>
  );
}
