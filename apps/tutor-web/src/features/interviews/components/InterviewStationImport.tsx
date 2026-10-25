"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  Label,
  RichTextEditor,
  SearchableSelect,
  type JSONContent,
} from "@altitutor/ui";
import {
  interviewText,
  type InterviewCatalog,
  type InterviewStation,
  type Json,
} from "@altitutor/shared";
import { ChevronLeft, ChevronRight, Settings2, X } from "lucide-react";
import {
  proseMirrorHasOuterTable,
  stripOuterTablesFromProseMirrorDoc,
} from "@/features/ucat/shared/lib/rich-text";
import {
  EXPANDABLE_DIALOG_TRANSITION,
  EXPANDED_DIALOG_CONTENT_CLASS,
  ExpandButton,
} from "@/shared/components/expandable-dialog";
import { cn } from "@/shared/utils";
import { parseStationImport } from "../lib/parse-station-import";
import { blankQuestion, blankStation } from "../lib/station-draft";
import { InterviewDocument, emptyDocument } from "./interview-ui";
import { InterviewStationEditor } from "./InterviewStationEditor";

const STEPS = [
  "Paste prompt",
  "Paste questions and rubric",
  "Preview and add",
] as const;

type PasteTableBehavior = "strip_all" | "strip_outside" | "keep";

const PASTE_TABLE_BEHAVIOR_OPTIONS: Array<{
  value: PasteTableBehavior;
  label: string;
}> = [
  { value: "strip_all", label: "Strip all tables" },
  { value: "strip_outside", label: "Strip outside tables only" },
  { value: "keep", label: "Keep formatting" },
];

function PasteSettings({
  label,
  value,
  behavior,
  onBehaviorChange,
  onChange,
}: {
  label: string;
  value: JSONContent;
  behavior: PasteTableBehavior;
  onBehaviorChange: (behavior: PasteTableBehavior) => void;
  onChange: (value: JSONContent) => void;
}) {
  const canStripOuterTables = proseMirrorHasOuterTable(value as Json);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          aria-label={`${label} paste settings`}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-2" align="end">
        <div className="space-y-1.5">
          <Label className="text-xs">Table paste handling</Label>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Applies on paste, including stripping Word formatting. The button
            strips outer tables from this document.
          </p>
          <SearchableSelect<(typeof PASTE_TABLE_BEHAVIOR_OPTIONS)[number]>
            items={PASTE_TABLE_BEHAVIOR_OPTIONS}
            value={
              PASTE_TABLE_BEHAVIOR_OPTIONS.find(
                (item) => item.value === behavior,
              ) ?? PASTE_TABLE_BEHAVIOR_OPTIONS[2]
            }
            onValueChange={(item) => item && onBehaviorChange(item.value)}
            getItemLabel={(item) => item.label}
            getItemId={(item) => item.value}
            fullWidth
            triggerClassName="w-full"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full"
            disabled={!canStripOuterTables}
            onClick={() => {
              const next = stripOuterTablesFromProseMirrorDoc(value as Json);
              if (next) onChange(next as JSONContent);
            }}
          >
            Strip outside tables
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function InterviewStationImport({
  catalog,
  close,
}: {
  catalog: InterviewCatalog;
  close: () => void;
}) {
  const [step, setStep] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [pasteTableBehavior, setPasteTableBehavior] =
    useState<PasteTableBehavior>("keep");
  const [promptSource, setPromptSource] = useState<JSONContent>(emptyDocument);
  const [questionsSource, setQuestionsSource] = useState<JSONContent | null>(
    null,
  );
  const [candidate, setCandidate] = useState<{
    station: InterviewStation;
    source: string;
  } | null>(null);
  const detected = useMemo(
    () => parseStationImport(promptSource),
    [promptSource],
  );
  const questionsDocument = questionsSource ?? detected.questionDocument;
  const parsed = useMemo(
    () => parseStationImport(promptSource, questionsDocument),
    [promptSource, questionsDocument],
  );
  const sourceKey = JSON.stringify([promptSource, questionsDocument]);
  const hasContent =
    !!interviewText(promptSource).trim() ||
    !!interviewText(questionsDocument).trim();
  const requestClose = () => {
    if (!hasContent || window.confirm("Discard this station import?")) close();
  };
  const activeDocument = step === 0 ? promptSource : questionsDocument;
  const setActiveDocument = (value: JSONContent) => {
    if (step === 0) setPromptSource(value);
    else setQuestionsSource(value);
  };
  if (step === 2 && candidate) {
    return (
      <InterviewStationEditor
        station={candidate.station}
        catalog={catalog}
        close={close}
        onBack={(station) => {
          setCandidate({ ...candidate, station });
          setStep(1);
        }}
      />
    );
  }
  const next = () => {
    if (step === 0) {
      setStep(1);
      return;
    }
    if (candidate?.source !== sourceKey) {
      const station =
        candidate?.station ?? blankStation(catalog.categories[0]?.id ?? "");
      setCandidate({
        source: sourceKey,
        station: {
          ...station,
          name: station.name || parsed.name,
          prompt: parsed.prompt,
          questions: parsed.questions.map((q) => ({
            ...blankQuestion(station.id),
            ...q,
          })),
        },
      });
    }
    setStep(2);
  };
  const canGoNext =
    step === 0
      ? !!interviewText(detected.prompt).trim()
      : parsed.questions.length > 0 && parsed.questions.length <= 100;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) requestClose();
      }}
    >
      <DialogContent
        className={cn(
          "flex h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:!h-[90vh] md:max-w-5xl [&>button]:hidden",
          EXPANDABLE_DIALOG_TRANSITION,
          expanded && EXPANDED_DIALOG_CONTENT_CLASS,
        )}
      >
        <div className="shrink-0 border-b bg-background">
          <DialogHeader className="px-6 pb-4 pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={requestClose}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="min-w-0 flex-1">
                  <DialogTitle>Import station</DialogTitle>
                  <DialogDescription>
                    Step {step + 1} of {STEPS.length}: {STEPS[step]}
                  </DialogDescription>
                </div>
              </div>
              <ExpandButton
                expanded={expanded}
                onToggle={() => setExpanded((current) => !current)}
              />
            </div>
          </DialogHeader>
          <div className="px-6 pb-4">
            <div className="flex items-center gap-2">
              {STEPS.map((title, index) => (
                <div
                  key={title}
                  className={cn(
                    "h-2 flex-1 rounded-full transition-colors",
                    index < step
                      ? "bg-primary"
                      : index === step
                        ? "bg-primary/50"
                        : "bg-muted",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col px-6 py-4">
          <div className="flex h-full min-h-0 flex-col gap-3">
            <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-base font-semibold">
                  {step === 0
                    ? "Paste prompt"
                    : "Paste questions and rubric"}
                </h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  {step === 0
                    ? "Paste the reading prompt, or copy the entire Word station document. Its Prompt section and Question table will be detected automatically."
                    : "Questions from the full document are already filled in. You can also paste a separate Question / Rubric table, or numbered questions with Rubric: beneath each question. Rubrics are optional; Feedback columns are ignored."}
                </p>
              </div>
              <PasteSettings
                label={step === 0 ? "Prompt settings" : "Question settings"}
                value={activeDocument}
                behavior={pasteTableBehavior}
                onBehaviorChange={setPasteTableBehavior}
                onChange={setActiveDocument}
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden md:flex-row md:gap-0">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col md:pr-4">
                <Label className="mb-2 shrink-0 text-xs font-medium text-muted-foreground">
                  {step === 0 ? "Prompt document" : "Questions document"}
                </Label>
                <div
                  role="group"
                  aria-label={
                    step === 0 ? "Prompt document" : "Questions document"
                  }
                  className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted/40 p-3 [&_.ProseMirror]:min-h-[12rem]"
                >
                  <RichTextEditor
                    key={step}
                    content={activeDocument}
                    onChange={setActiveDocument}
                    placeholder={
                      step === 0
                        ? "Paste prompt or entire station…"
                        : "Paste questions and optional rubrics…"
                    }
                    minHeight="12rem"
                    autoHeight
                    floatingToolbar
                    pasteStripFormatting
                    pasteTableBehavior={pasteTableBehavior}
                  />
                </div>
              </div>
              <div
                className="hidden shrink-0 self-stretch md:block md:w-px md:bg-border"
                aria-hidden
              />
              <div
                className="flex min-h-0 min-w-0 flex-1 flex-col md:pl-4"
                aria-label="Detected station content"
              >
                <div className="mb-2 flex shrink-0 items-baseline justify-between gap-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {step === 0
                      ? "Detected prompt"
                      : "Detected questions"}
                  </Label>
                  {step === 1 ? (
                    <span className="text-xs text-muted-foreground">
                      {parsed.questions.length} question
                      {parsed.questions.length === 1 ? "" : "s"}
                    </span>
                  ) : null}
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                  {step === 0 ? (
                    <>
                      {detected.name ? (
                        <p className="text-sm font-medium">{detected.name}</p>
                      ) : null}
                      {interviewText(detected.prompt).trim() ? (
                        <InterviewDocument value={detected.prompt} />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Paste a prompt to see its preview.
                        </p>
                      )}
                      {detected.questions.length > 0 ? (
                        <p className="text-sm">
                          {detected.questions.length} linked questions detected.
                          They will be carried into the next step.
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {parsed.questions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No questions detected yet. Paste a question table or
                          numbered list.
                        </p>
                      ) : null}
                      {parsed.questions.map((question, index) => (
                        <article
                          key={index}
                          className="space-y-3 rounded-lg border p-4"
                        >
                          <h3 className="text-sm font-semibold">
                            Question {index + 1}
                          </h3>
                          <InterviewDocument value={question.question} />
                          <h4 className="text-xs font-medium text-muted-foreground">
                            Rubric
                          </h4>
                          {interviewText(question.rubric).trim() ? (
                            <InterviewDocument value={question.rubric} />
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No rubric supplied
                            </p>
                          )}
                        </article>
                      ))}
                    </>
                  )}
                  {(step === 0 ? detected.warnings : parsed.warnings).map(
                    (warning) => (
                      <p
                        key={warning}
                        role="status"
                        className="text-sm text-amber-700 dark:text-amber-400"
                      >
                        {warning}
                      </p>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t bg-background px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(0)}
            disabled={step === 0}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
          <div className="flex-1" />
          <Button type="button" onClick={next} disabled={!canGoNext}>
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
