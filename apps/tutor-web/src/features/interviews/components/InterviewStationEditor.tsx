"use client";

import { useState } from "react";
import {
  Button,
  Input,
  ResponsiveResizablePanels,
  type JSONContent,
} from "@altitutor/ui";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import {
  interviewText,
  type InterviewCatalog,
  type InterviewQuestion,
  type InterviewStation,
  type InterviewTemplate,
} from "@altitutor/shared";
import { Loader2, Sparkles, X } from "lucide-react";
import { UcatDialogShell } from "@/features/ucat/shared/dialog-shell";
import { UcatSetPropertyRow } from "@/features/ucat/sets/components/UcatSetPropertyRow";
import { tutorCardCn } from "@/shared/lib/tutor-visual";
import {
  suggestInterviewQuestionTags,
  suggestInterviewStationName,
} from "../api/interviews";
import { useInterviewCommand } from "../hooks/use-interviews";
import { blankQuestion } from "../lib/station-draft";
import {
  InterviewDocument,
  InterviewError,
  InterviewField,
  InterviewSelect,
} from "./interview-ui";
import { InterviewEditorDialog } from "./InterviewEditorDialog";

function AiHoverButton({
  label,
  pending,
  disabled,
  onClick,
}: {
  label: string;
  pending: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled || pending}
      onClick={onClick}
      className="group relative inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
      ) : (
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
      )}
      <span className="pointer-events-none absolute left-full top-1/2 z-10 ml-1 hidden -translate-y-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-sm group-hover:block group-focus-visible:block">
        {label}
      </span>
    </button>
  );
}

export function InterviewStationEditor({
  station,
  catalog,
  close,
  onBack,
  onSaved,
}: {
  station: InterviewStation;
  catalog: InterviewCatalog;
  close: () => void;
  onBack?: (draft: InterviewStation) => void;
  onSaved?: (station: InterviewStation) => void;
}) {
  const [draft, setDraft] = useState(station);
  const [baseVersion] = useState(station.version);
  const [naming, setNaming] = useState(false);
  const [taggingId, setTaggingId] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const command = useInterviewCommand();
  const canName =
    !!interviewText(draft.prompt).trim() ||
    draft.questions.some((question) => interviewText(question.question).trim());
  const nameStation = async () => {
    setAiError(null);
    setNaming(true);
    try {
      const result = await suggestInterviewStationName({
        prompt: interviewText(draft.prompt),
        questions: draft.questions.map((question) =>
          interviewText(question.question),
        ),
      });
      setDraft((current) => ({ ...current, name: result.name }));
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : "Unable to name this station.",
      );
    } finally {
      setNaming(false);
    }
  };
  const tagQuestion = async (question: InterviewQuestion) => {
    setAiError(null);
    setTaggingId(question.id);
    try {
      const result = await suggestInterviewQuestionTags({
        prompt: interviewText(draft.prompt),
        question: interviewText(question.question),
        tags: catalog.tags.map((tag) => ({ id: tag.id, name: tag.name })),
      });
      setDraft((current) => ({
        ...current,
        questions: current.questions.map((item) =>
          item.id === question.id ? { ...item, tagIds: result.tagIds } : item,
        ),
      }));
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : "Unable to tag this question.",
      );
    } finally {
      setTaggingId(null);
    }
  };
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
    const result = await command.mutateAsync({
      type: "saveStation",
      commandId: randomUuid(),
      expectedVersion: baseVersion,
      station: draft,
    });
    onSaved?.({ ...draft, version: result.version });
    close();
  };
  const [editingInterview, setEditingInterview] =
    useState<InterviewTemplate | null>(null);
  const placements = catalog.interviews.flatMap((interview) =>
    interview.stations.flatMap((placement, index) =>
      placement.stationId === station.id
        ? [{ interview, number: index + 1, key: placement.id }]
        : [],
    ),
  );
  return (
    <UcatDialogShell
      open
      onClose={() => {
        if (
          !command.isPending &&
          ((!onBack && draft === station) ||
            window.confirm("Discard unsaved station changes?"))
        )
          close();
      }}
      title={
        onBack
          ? "3. Preview and add station"
          : baseVersion
            ? "Edit station"
            : "New station"
      }
      subtitle={
        onBack
          ? "Check the prompt, questions and rubrics. Choose a category and correct anything before adding the station."
          : "Edit the whole station here. Changes update prepared interviews; started rounds keep their wording. Rubric corrections also reach active rounds."
      }
      onSave={() => void save().catch(() => undefined)}
      saveLabel={onBack ? "Add station" : "Save station"}
      footerActions={
        onBack ? (
          <Button
            variant="outline"
            disabled={command.isPending}
            onClick={() => onBack(draft)}
          >
            Back
          </Button>
        ) : undefined
      }
      isSaving={command.isPending}
      saveDisabled={
        command.isPending ||
        !draft.name.trim() ||
        !draft.categoryId ||
        draft.name.length > 500 ||
        !Number.isFinite(draft.maximumPoints) ||
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
      <div className="flex h-full min-h-0 flex-col">
        {command.error || aiError ? (
          <div className="shrink-0 px-6 pt-4">
            <InterviewError error={command.error ?? new Error(aiError ?? "")} />
          </div>
        ) : null}
        <ResponsiveResizablePanels
          id="interview-station-editor"
          breakpoint="lg"
          stackOnNarrow
          primaryDefaultSize="70%"
          primaryMinSize={420}
          secondaryDefaultSize={320}
          secondaryMinSize={260}
          secondaryMaxSize={480}
          handleLabel="Resize station properties"
          primary={
            <section className="flex h-full min-h-0 flex-col overflow-y-auto p-4 lg:p-6">
              <InterviewField label="Prompt">
                <InterviewDocument
                  value={draft.prompt as JSONContent}
                  placeholder="Reading prompt shown to the student"
                  onChange={(prompt) => setDraft({ ...draft, prompt })}
                />
              </InterviewField>
              <div className="mt-6 space-y-4">
                {draft.questions.map((question, index) => (
                  <section
                    key={question.id}
                    className={tutorCardCn("space-y-4 p-4")}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="font-semibold">Question {index + 1}</h3>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          Recommended time
                          <Input
                            type="number"
                            min={1}
                            max={7200}
                            aria-label={`Recommended answer time for question ${index + 1} in seconds`}
                            className="h-8 w-20"
                            value={question.suggestedTimeSeconds}
                            onChange={(e) =>
                              updateQuestion({
                                ...question,
                                suggestedTimeSeconds: Number(e.target.value),
                              })
                            }
                          />
                          <span>s</span>
                        </label>
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
                        placeholder="Question the tutor asks"
                        onChange={(value) =>
                          updateQuestion({ ...question, question: value })
                        }
                      />
                    </InterviewField>
                    <InterviewField label="Rubric">
                      <InterviewDocument
                        value={question.rubric as JSONContent}
                        placeholder="Marking guidance"
                        onChange={(rubric) =>
                          updateQuestion({ ...question, rubric })
                        }
                      />
                    </InterviewField>
                    <div className="space-y-2">
                      <div className="flex items-center gap-1">
                        <div className="text-sm font-medium">Tags</div>
                        <AiHoverButton
                          label="Auto tag"
                          pending={taggingId === question.id}
                          disabled={
                            taggingId != null ||
                            !catalog.tags.length ||
                            !interviewText(question.question).trim()
                          }
                          onClick={() => void tagQuestion(question)}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {question.tagIds.map((id) => {
                          const name =
                            catalog.tags.find((tag) => tag.id === id)?.name ??
                            "Tag";
                          return (
                            <span
                              key={id}
                              className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted px-2 py-1 text-xs font-medium"
                            >
                              <span className="min-w-0 truncate">{name}</span>
                              <button
                                type="button"
                                aria-label={`Remove ${name}`}
                                className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                onClick={() =>
                                  updateQuestion({
                                    ...question,
                                    tagIds: question.tagIds.filter(
                                      (tag) => tag !== id,
                                    ),
                                  })
                                }
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                      <InterviewSelect
                        label="Add tag"
                        value={null}
                        options={catalog.tags
                          .filter((tag) => !question.tagIds.includes(tag.id))
                          .map((tag) => ({ id: tag.id, label: tag.name }))}
                        onChange={(id) => {
                          if (id)
                            updateQuestion({
                              ...question,
                              tagIds: [...question.tagIds, id],
                            });
                        }}
                      />
                    </div>
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
            </section>
          }
          secondary={
            <aside className="flex h-full min-h-0 flex-col overflow-y-auto bg-background p-4">
              <h2 className="mb-3 text-sm font-semibold">Properties</h2>
              <div className={tutorCardCn("space-y-1 p-3")}>
                <UcatSetPropertyRow
                  label={
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      Station name
                      <AiHoverButton
                        label="Auto generate"
                        pending={naming}
                        disabled={!canName}
                        onClick={() => void nameStation()}
                      />
                    </span>
                  }
                >
                  <Input
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </UcatSetPropertyRow>
                <UcatSetPropertyRow label="Category">
                  <InterviewSelect
                    label="Category"
                    value={draft.categoryId}
                    options={catalog.categories.map((c) => ({
                      id: c.id,
                      label: c.name,
                    }))}
                    onChange={(id) =>
                      setDraft({ ...draft, categoryId: id ?? "" })
                    }
                  />
                </UcatSetPropertyRow>
                <UcatSetPropertyRow label="Maximum score">
                  <Input
                    type="number"
                    min={0.01}
                    max={1000}
                    step="any"
                    value={draft.maximumPoints}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        maximumPoints: Number(e.target.value),
                      })
                    }
                  />
                </UcatSetPropertyRow>
              </div>
              <div className={tutorCardCn("mt-4 space-y-2 p-3")}>
                <h2 className="text-sm font-semibold">Interview</h2>
                {placements.length ? (
                  <ul className="space-y-1">
                    {placements.map((placement) => (
                      <li key={placement.key}>
                        <button
                          type="button"
                          className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-muted"
                          onClick={() =>
                            setEditingInterview(placement.interview)
                          }
                        >
                          <span className="block text-sm font-medium text-primary">
                            {placement.interview.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            Station {placement.number}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    This station is not in an interview yet.
                  </p>
                )}
              </div>
            </aside>
          }
        />
      </div>
      <InterviewEditorDialog
        original={editingInterview}
        catalog={catalog}
        mode="edit"
        onClose={() => setEditingInterview(null)}
      />
    </UcatDialogShell>
  );
}
