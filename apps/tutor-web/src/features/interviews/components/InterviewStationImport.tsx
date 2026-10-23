"use client";

import { useMemo, useState } from "react";
import { Button, RichTextEditor, type JSONContent } from "@altitutor/ui";
import {
  interviewText,
  type InterviewCatalog,
  type InterviewStation,
} from "@altitutor/shared";
import { UcatDialogShell } from "@/features/ucat/shared/dialog-shell";
import { parseStationImport } from "../lib/parse-station-import";
import { blankQuestion, blankStation } from "../lib/station-draft";
import { InterviewDocument, emptyDocument } from "./interview-ui";
import { InterviewStationEditor } from "./InterviewStationEditor";

export function InterviewStationImport({
  catalog,
  close,
}: {
  catalog: InterviewCatalog;
  close: () => void;
}) {
  const [step, setStep] = useState(0);
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
  return (
    <UcatDialogShell
      open
      onClose={requestClose}
      title="Import station"
      subtitle="Paste prompt → paste questions and rubric → preview and add"
      defaultExpanded
      onSave={next}
      saveLabel={step === 0 ? "Continue to questions" : "Preview station"}
      saveDisabled={
        step === 0
          ? !interviewText(detected.prompt).trim()
          : parsed.questions.length === 0 || parsed.questions.length > 100
      }
      footerActions={
        step === 1 ? (
          <Button variant="outline" onClick={() => setStep(0)}>
            Back
          </Button>
        ) : undefined
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:p-6">
        <ol
          aria-label="Import steps"
          className="flex flex-wrap gap-4 text-sm text-muted-foreground"
        >
          {[
            "Paste prompt",
            "Paste questions and rubric",
            "Preview and add",
          ].map((title, index) => (
            <li
              key={title}
              aria-current={step === index ? "step" : undefined}
              className={
                step === index ? "font-semibold text-foreground" : undefined
              }
            >
              {index + 1}. {title}
            </li>
          ))}
        </ol>
        <div className="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
          <section className="min-w-0 space-y-3 lg:overflow-y-auto">
            <h2 className="font-semibold">
              {step === 0 ? "1. Paste prompt" : "2. Paste questions and rubric"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {step === 0
                ? "Paste the reading prompt, or copy the entire Word station document. Its Prompt section and Question table will be detected automatically."
                : "Questions from the full document are already filled in. You can also paste a separate Question / Rubric table, or numbered questions with Rubric: beneath each question. Rubrics are optional; Feedback columns are ignored."}
            </p>
            <div
              role="group"
              aria-label={step === 0 ? "Prompt document" : "Questions document"}
              className="rounded-md border border-input bg-background px-3 py-2 [&_.ProseMirror]:min-h-[16rem]"
            >
              <RichTextEditor
                key={step}
                content={step === 0 ? promptSource : questionsDocument}
                onChange={step === 0 ? setPromptSource : setQuestionsSource}
                placeholder={
                  step === 0
                    ? "Paste prompt or entire station…"
                    : "Paste questions and optional rubrics…"
                }
                minHeight="16rem"
                autoHeight
                floatingToolbar
                pastePlainTextAsParagraphs
                pasteStripFormatting
                pasteTableBehavior="keep"
              />
            </div>
          </section>
          <section
            className="min-w-0 space-y-4 lg:overflow-y-auto"
            aria-label="Detected station content"
          >
            <h2 className="font-semibold">
              {step === 0
                ? "Detected prompt"
                : `${parsed.questions.length} questions detected`}
            </h2>
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
                    {detected.questions.length} linked questions detected. They
                    will be carried into the next step.
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
          </section>
        </div>
      </div>
    </UcatDialogShell>
  );
}
