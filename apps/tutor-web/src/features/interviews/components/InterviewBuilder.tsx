"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
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
import {
  interviewText,
  type InterviewCatalog,
  type InterviewTemplate,
} from "@altitutor/shared";
import {
  useInterviewCatalog,
  useInterviewCommand,
} from "../hooks/use-interviews";
import { UcatPropertyRow } from "@/features/ucat/shared/components/UcatPropertyRow";
import {
  InterviewDocument,
  InterviewError,
  InterviewField,
  InterviewPanel,
  InterviewSearch,
  InterviewSelect,
} from "./interview-ui";
import { tutorBtnOutline, tutorBtnPrimary } from "@/shared/lib/tutor-visual";
import { cn } from "@/shared/utils";
import { useBuilderDraft } from "../hooks/use-builder-draft";
import { InterviewPageHeader } from "./interview-page";

export type InterviewEditorBind = {
  save: () => Promise<void>;
  canSave: boolean;
  saving: boolean;
  canPrint: boolean;
};

function EditorField({
  embedded,
  label,
  children,
}: {
  embedded: boolean;
  label: string;
  children: ReactNode;
}) {
  if (embedded) return <UcatPropertyRow label={label}>{children}</UcatPropertyRow>;
  return <InterviewField label={label}>{children}</InterviewField>;
}

function move<T>(items: T[], index: number, offset: number): T[] {
  const next = [...items];
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function BuilderEditor({
  original,
  catalog,
  embedded = false,
  onBind,
  onSaved,
}: {
  original: InterviewTemplate;
  catalog: InterviewCatalog;
  embedded?: boolean;
  onBind?: (state: InterviewEditorBind) => void;
  onSaved?: (id: string) => void;
}) {
  const searchParams = useSearchParams();
  const recovery = useBuilderDraft(catalog.actorId, original);
  const { draft, dirty } = recovery;
  const [selected, setSelected] = useState(
    searchParams.get("station") ?? original.stations[0]?.id,
  );
  const [picker, setPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const command = useInterviewCommand();
  const station =
    draft.stations.find((item) => item.id === selected) ?? draft.stations[0];
  const change = recovery.change;
  const updateStation = (value: typeof station) => {
    change({
      ...draft,
      stations: draft.stations.map((item) =>
        item.id === value.id ? value : item,
      ),
    });
  };
  const save = async () => {
    if (recovery.conflict)
      throw new Error("Load the latest saved interview before saving.");
    const result = await command.mutateAsync({
      type: "saveInterview",
      commandId: crypto.randomUUID(),
      expectedVersion: recovery.version,
      interview: draft,
    });
    recovery.saved(result.version, draft);
    onSaved?.(draft.id);
  };
  const canSave =
    !recovery.conflict &&
    !command.isPending &&
    !!draft.name.trim() &&
    (recovery.dirty || original.version === 0);
  const canPrint =
    original.version > 0 &&
    !recovery.dirty &&
    draft.stations.some((station) => station.questions.length > 0);
  const onBindRef = useRef(onBind);
  const saveRef = useRef(save);
  onBindRef.current = onBind;
  saveRef.current = save;
  useEffect(() => {
    onBindRef.current?.({
      save: () => saveRef.current(),
      canSave,
      saving: command.isPending,
      canPrint,
    });
  }, [canPrint, canSave, command.isPending]);
  const print = (stationId?: string) => {
    window.open(
      `/interviews/${draft.id}/print${stationId ? `?station=${stationId}` : ""}`,
      "_blank",
      "noopener",
    );
  };
  const options = catalog.questions.filter(
    (question) =>
      !question.archived &&
      (!category || question.categoryId === category) &&
      interviewText(question.question)
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const duplicates = draft.stations
    .flatMap((item) => item.questions)
    .map((placement) => placement.questionId);
  const printPrompts = (
    <Button
      variant="outline"
      className={tutorBtnOutline}
      disabled={dirty || !draft.stations.length}
      onClick={() => print()}
    >
      Print prompts
    </Button>
  );
  const saveInterview = (
    <Button
      className={tutorBtnPrimary}
      disabled={!canSave}
      onClick={() => void save().catch(() => undefined)}
    >
      {command.isPending ? "Saving…" : dirty ? "Save interview" : "Saved"}
    </Button>
  );
  return (
    <div className={embedded ? "space-y-6 p-6" : "space-y-6 py-8 md:py-10"}>
      {embedded ? null : (
        <InterviewPageHeader
          title={draft.name || "Interview"}
          backHref="/interviews/bank"
          backLabel="Back to interview bank"
          breadcrumbs={[
            { label: "Interviews", href: "/interviews" },
            { label: "Interview bank", href: "/interviews/bank" },
            { label: draft.name || "Interview" },
          ]}
          actions={
            <div className="flex gap-2">
              {printPrompts}
              {saveInterview}
            </div>
          }
        />
      )}
      <InterviewError error={command.error} />
      {(recovery.recovered || recovery.conflict) && (
        <div role="status" className="rounded-xl border bg-muted p-4 text-sm">
          {recovery.conflict
            ? "Another tutor saved a newer interview. Your draft is retained here; saving is blocked to protect their changes. Copy anything you need before loading the saved interview."
            : "Your unsaved interview draft has been restored on this device."}
          <Button variant="outline" className="ml-3" onClick={recovery.discard}>
            Discard draft and load saved interview
          </Button>
        </div>
      )}
      {recovery.storageError && (
        <p role="alert" className="text-sm text-destructive">
          Browser draft storage is unavailable. Save before leaving this page.
        </p>
      )}
      <InterviewPanel>
        <div className={embedded ? "space-y-1" : "grid gap-4 md:grid-cols-[2fr_1fr_1fr]"}>
          <EditorField embedded={embedded} label="Interview name">
            <Input
              value={draft.name}
              onChange={(event) =>
                change({ ...draft, name: event.target.value })
              }
            />
          </EditorField>
          <EditorField embedded={embedded} label="Reading time (seconds)">
            <Input
              type="number"
              min={1}
              max={3600}
              value={draft.readingTimeSeconds}
              onChange={(event) =>
                change({
                  ...draft,
                  readingTimeSeconds: Number(event.target.value),
                })
              }
            />
          </EditorField>
          <EditorField embedded={embedded} label="Question time (seconds)">
            <Input
              type="number"
              min={1}
              max={7200}
              value={draft.questionTimeSeconds}
              onChange={(event) =>
                change({
                  ...draft,
                  questionTimeSeconds: Number(event.target.value),
                })
              }
            />
          </EditorField>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <Checkbox
            checked={draft.recordingEnabled}
            onCheckedChange={(checked) =>
              change({ ...draft, recordingEnabled: checked === true })
            }
          />
          Record interviews by default (can be changed for each round)
        </label>
      </InterviewPanel>
      {new Set(duplicates).size < duplicates.length && (
        <div className="rounded-xl bg-amber-500/10 p-4 text-sm">
          A question is used more than once in this interview. This is allowed;
          check that the repetition is intentional.
        </div>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <InterviewPanel title="Stations">
          <div className="space-y-2">
            {draft.stations.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "rounded-xl p-2",
                  item.id === station?.id && "bg-muted",
                )}
              >
                <button
                  className="w-full p-2 text-left text-sm font-medium"
                  onClick={() => setSelected(item.id)}
                >
                  {index + 1}. {item.name}
                </button>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={index === 0}
                    aria-label={`Move ${item.name} up`}
                    onClick={() =>
                      change({
                        ...draft,
                        stations: move(draft.stations, index, -1),
                      })
                    }
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={index === draft.stations.length - 1}
                    aria-label={`Move ${item.name} down`}
                    onClick={() =>
                      change({
                        ...draft,
                        stations: move(draft.stations, index, 1),
                      })
                    }
                  >
                    ↓
                  </Button>
                  <span className="self-center text-xs text-muted-foreground">
                    {item.questions.length} questions
                  </span>
                </div>
              </div>
            ))}
          </div>
          <Button
            className={cn(tutorBtnOutline, "mt-4 w-full")}
            disabled={draft.stations.length >= 6}
            variant="outline"
            onClick={() => {
              const next = {
                id: crypto.randomUUID(),
                name: `Station ${draft.stations.length + 1}`,
                maximumPoints: 6,
                questions: [],
              };
              change({ ...draft, stations: [...draft.stations, next] });
              setSelected(next.id);
            }}
          >
            Add station
          </Button>
        </InterviewPanel>
        {station && (
          <InterviewPanel
            title="Station editor"
            action={
              embedded ? null : (
                <Button
                  variant="outline"
                  className={tutorBtnOutline}
                  disabled={dirty || !station.questions.length}
                  onClick={() => print(station.id)}
                >
                  Print prompt
                </Button>
              )
            }
          >
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
                <InterviewField label="Station name">
                  <Input
                    value={station.name}
                    onChange={(event) =>
                      updateStation({ ...station, name: event.target.value })
                    }
                  />
                </InterviewField>
                <InterviewField label="Maximum points">
                  <Input
                    type="number"
                    step="any"
                    min={0.01}
                    value={station.maximumPoints}
                    onChange={(event) =>
                      updateStation({
                        ...station,
                        maximumPoints: Number(event.target.value),
                      })
                    }
                  />
                </InterviewField>
              </div>
              <p className="text-sm text-muted-foreground">
                The first question supplies the reading and printed prompt.
                Reordering questions changes it.
              </p>
              {station.questions.map((placement, index) => {
                const question = catalog.questions.find(
                  (item) => item.id === placement.questionId,
                );
                return (
                  <div key={placement.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{index + 1}</Badge>
                        {index === 0 && (
                          <Badge variant="outline">Reading prompt</Badge>
                        )}
                        {question?.archived && (
                          <Badge variant="outline">Archived</Badge>
                        )}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={index === 0}
                          aria-label={`Move question ${index + 1} up`}
                          onClick={() =>
                            updateStation({
                              ...station,
                              questions: move(station.questions, index, -1),
                            })
                          }
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={index === station.questions.length - 1}
                          aria-label={`Move question ${index + 1} down`}
                          onClick={() =>
                            updateStation({
                              ...station,
                              questions: move(station.questions, index, 1),
                            })
                          }
                        >
                          ↓
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateStation({
                              ...station,
                              questions: station.questions.filter(
                                (item) => item.id !== placement.id,
                              ),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    <InterviewDocument
                      value={(question?.question as JSONContent) ?? null}
                    />
                    {index === 0 && (
                      <div className="mt-3 rounded-lg bg-muted/40 p-3">
                        <InterviewDocument
                          value={(question?.prompt as JSONContent) ?? null}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              <Button
                variant="outline"
                className={tutorBtnOutline}
                onClick={() => setPicker(true)}
              >
                Add questions
              </Button>
              <div className="border-t pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove ${station.name} and its question placements from this interview?`,
                      )
                    )
                      change({
                        ...draft,
                        stations: draft.stations.filter(
                          (item) => item.id !== station.id,
                        ),
                      });
                  }}
                >
                  Remove station
                </Button>
              </div>
            </div>
          </InterviewPanel>
        )}
      </div>
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="max-h-[85dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add questions to {station?.name}</DialogTitle>
          </DialogHeader>
          <InterviewSearch
            value={search}
            onChange={setSearch}
            placeholder="Search bank questions…"
          >
            <InterviewSelect
              label="Category"
              clear
              value={category}
              onChange={setCategory}
              options={catalog.categories.map((item) => ({
                id: item.id,
                label: item.name,
              }))}
            />
          </InterviewSearch>
          {options.map((question) => (
            <div
              key={question.id}
              className="flex items-center justify-between gap-4 border-b py-3"
            >
              <div>
                <p className="text-sm">{interviewText(question.question)}</p>
                {duplicates.includes(question.id) && (
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Already used in this interview
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                className={tutorBtnOutline}
                onClick={() => {
                  if (station)
                    updateStation({
                      ...station,
                      questions: [
                        ...station.questions,
                        { id: crypto.randomUUID(), questionId: question.id },
                      ],
                    });
                }}
              >
                Add
              </Button>
            </div>
          ))}
          <Button onClick={() => setPicker(false)}>Done adding</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function InterviewBuilder({ id }: { id: string }) {
  const query = useInterviewCatalog();
  const interview = query.data?.interviews.find((item) => item.id === id);
  if (!query.data || !interview)
    return (
      <div className="py-8">
        <InterviewError
          error={query.error}
          retry={() => void query.refetch()}
        />
        {query.isPending ? "Loading interview…" : "Interview not found."}
      </div>
    );
  return (
    <BuilderEditor
      key={`${query.data.actorId}:${interview.id}`}
      original={interview}
      catalog={query.data}
    />
  );
}

export function InterviewPrint({ id }: { id: string }) {
  const query = useInterviewCatalog();
  const search = useSearchParams();
  const interview = query.data?.interviews.find((item) => item.id === id);
  if (!interview) return <InterviewError error={query.error} />;
  const stations = interview.stations.filter(
    (station) => !search.get("station") || station.id === search.get("station"),
  );
  return (
    <div className="space-y-6 py-8">
      <div className="print:hidden">
        <Button onClick={() => window.print()}>Print / save as PDF</Button>
        <p className="mt-3 text-sm text-muted-foreground">
          Each station starts on a new page. Station names are not shown to
          students.
        </p>
      </div>
      <style>
        {
          "@media print { nav, aside { display:none !important; } body { background:white!important; } .interview-print-page { break-after:page; min-height:90vh; } .interview-print-page:last-child { break-after:auto; } }"
        }
      </style>
      {stations.map((station) => (
        <section
          key={station.id}
          className="interview-print-page rounded-xl border p-10 print:border-0"
        >
          <h1 className="mb-8 text-3xl font-semibold">
            Station{" "}
            {interview.stations.findIndex((item) => item.id === station.id) + 1}
          </h1>
          <InterviewDocument
            value={
              (query.data?.questions.find(
                (question) => question.id === station.questions[0]?.questionId,
              )?.prompt as JSONContent) ?? null
            }
          />
        </section>
      ))}
    </div>
  );
}
