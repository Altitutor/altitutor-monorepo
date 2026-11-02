"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type JSONContent,
} from "@altitutor/ui";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import { AlertCircle, Check, Circle, Loader2 } from "lucide-react";
import {
  INTERVIEW_NOT_SCORED,
  interviewText,
  type InterviewStationAttempt,
  type InterviewRound,
  type InterviewSnapshotStation,
} from "@altitutor/shared";
import { useAttemptDraft } from "../hooks/use-attempt-draft";
import { useInterviewCommand } from "../hooks/use-interviews";
import {
  ConfirmAction,
  InterviewDocument,
  InterviewError,
  InterviewPanel,
} from "./interview-ui";
import { tutorBtnOutline } from "@/shared/lib/tutor-visual";
import { cn } from "@/shared/utils";

function blankFeedbackCopy(items: string[]) {
  const list =
    items.length === 1
      ? items[0]
      : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  return `${list} ${items.length === 1 ? "is" : "are"} blank. Finish feedback anyway?`;
}

function missingFeedback(
  station: InterviewSnapshotStation,
  draft: {
    generalFeedback?: InterviewStationAttempt["generalFeedback"];
    feedback: InterviewStationAttempt["feedback"];
  },
) {
  const missing: string[] = [];
  if (!interviewText(draft.generalFeedback ?? null).trim())
    missing.push("General station feedback");
  station.questions.forEach((question, index) => {
    const value =
      draft.feedback.find((item) => item.placementId === question.id)?.value ??
      null;
    if (!interviewText(value).trim())
      missing.push(`Question ${index + 1} feedback`);
  });
  return missing;
}

const feedbackLock = "You can't start typing feedback until reading time.";

function LockedEntry({
  locked,
  children,
}: {
  locked: boolean;
  children: React.ReactNode;
}) {
  if (!locked) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          tabIndex={0}
          className="cursor-not-allowed rounded-md bg-muted/70 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="pointer-events-none opacity-70">{children}</div>
        </div>
      </TooltipTrigger>
      <TooltipContent>{feedbackLock}</TooltipContent>
    </Tooltip>
  );
}

function RecommendedAnswerTime({
  seconds,
  className,
}: {
  seconds: number;
  className?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <p
            tabIndex={0}
            className={cn(
              "text-sm font-normal text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
              className,
            )}
          >
            {seconds}s
          </p>
        </TooltipTrigger>
        <TooltipContent>Recommended answer time</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function FeedbackSaveStatus({
  state,
}: {
  state: "saved" | "saving" | "failed" | "unsaved";
}) {
  const detail =
    state === "saved"
      ? "All feedback saved"
      : state === "saving"
        ? "Saving feedback…"
        : state === "failed"
          ? "Save failed — your draft is retained in this tab"
          : "Unsaved changes";
  const Icon =
    state === "saved"
      ? Check
      : state === "saving"
        ? Loader2
        : state === "failed"
          ? AlertCircle
          : Circle;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="status"
            aria-label={detail}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-full",
              state === "failed"
                ? "text-destructive"
                : state === "saved"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : state === "unsaved"
                    ? "text-amber-700 dark:text-amber-300"
                    : "text-muted-foreground",
            )}
          >
            <Icon
              aria-hidden
              className={cn("size-4", state === "saving" && "animate-spin")}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>{detail}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function ScoreControl({
  id,
  maximumPoints,
  score,
  notScored,
  disabled,
  onScore,
  onNotScored,
}: {
  id: string;
  maximumPoints: number;
  score: number | null;
  notScored: boolean;
  disabled: boolean;
  onScore: (score: number | null) => void;
  onNotScored: (notScored: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor={id} className="text-sm">
        Score
      </label>
      <Input
        id={id}
        className="w-24"
        type="number"
        min={0}
        max={maximumPoints}
        step="any"
        value={notScored ? "" : (score ?? "")}
        disabled={disabled || notScored}
        onChange={(event) =>
          onScore(event.target.value === "" ? null : Number(event.target.value))
        }
      />
      <span className="text-sm text-muted-foreground">/ {maximumPoints}</span>
      <label className="ml-auto inline-flex items-center gap-2 text-sm">
        Not scored
        <Switch
          checked={notScored}
          disabled={disabled}
          aria-label="Not scored"
          onCheckedChange={onNotScored}
        />
      </label>
    </div>
  );
}

export function AttemptEditor({
  round,
  station,
  attempt,
  registerFlush,
  registerFinish,
  onFinishFeedback,
  leading,
}: {
  round: InterviewRound;
  station: InterviewSnapshotStation;
  attempt: InterviewStationAttempt;
  registerFlush?: (flush: (() => Promise<void>) | null) => void;
  registerFinish?: (finish: (() => void) | null) => void;
  onFinishFeedback?: () => void;
  leading?: React.ReactNode;
}) {
  const {
    draft,
    update,
    flush,
    state,
    error,
    newerRevision,
    recoveryUnavailable,
    loadSaved,
    keepDraft,
  } = useAttemptDraft(round.id, attempt);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [scorePrompt, setScorePrompt] = useState(false);
  const [blankFeedback, setBlankFeedback] = useState<string[] | null>(null);
  const notScored = !!draft.notAssessedReason?.trim();
  const [rubric, setRubric] = useState<JSONContent | null>(null);
  const [editingRubric, setEditingRubric] = useState(false);
  const [editingRubricVersion, setEditingRubricVersion] = useState(0);
  const command = useInterviewCommand();
  const seenRubricVersions = useRef(
    new Map(station.questions.map((item) => [item.id, item.rubricVersion])),
  );
  const [updatedRubricIds, setUpdatedRubricIds] = useState<string[]>([]);
  useEffect(() => {
    const changed = station.questions
      .filter(
        (item) =>
          seenRubricVersions.current.has(item.id) &&
          seenRubricVersions.current.get(item.id) !== item.rubricVersion,
      )
      .map((item) => item.id);
    station.questions.forEach((item) =>
      seenRubricVersions.current.set(item.id, item.rubricVersion),
    );
    if (changed.length)
      setUpdatedRubricIds((ids) => Array.from(new Set([...ids, ...changed])));
  }, [station.questions]);
  const question = station.questions[questionIndex];
  const response = draft.feedback.find(
    (feedback) => feedback.placementId === question?.id,
  );
  useEffect(() => {
    registerFlush?.(flush);
    return () => registerFlush?.(null);
  }, [flush, registerFlush]);
  useEffect(() => {
    registerFinish?.(() => {
      if (draft.score === null && !draft.notAssessedReason?.trim()) {
        setScorePrompt(true);
        return;
      }
      const missing = missingFeedback(station, draft);
      if (missing.length) setBlankFeedback(missing);
      else onFinishFeedback?.();
    });
    return () => registerFinish?.(null);
  }, [draft, onFinishFeedback, registerFinish, station]);
  const writeQuestionFeedback = (value: JSONContent) => {
    if (!question) return;
    update({
      ...draft,
      feedback: [
        ...draft.feedback.filter(
          (feedback) => feedback.placementId !== question.id,
        ),
        { placementId: question.id, value },
      ],
    });
  };
  const rubricDialog = (
    <Dialog open={editingRubric} onOpenChange={setEditingRubric}>
      <DialogContent className="max-h-[85dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit shared rubric</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This change applies to every active round using this question.
          Question wording stays fixed.
        </p>
        <InterviewDocument value={rubric} onChange={setRubric} />
        <InterviewError error={command.error} />
        <Button
          disabled={command.isPending || !question}
          onClick={() => {
            if (question)
              void command
                .mutateAsync({
                  type: "saveRubric",
                  stationId: station.stationId ?? "",
                  commandId: randomUuid(),
                  questionId: question.questionId,
                  expectedVersion: editingRubricVersion,
                  rubric,
                })
                .then(() => setEditingRubric(false))
                .catch(() => undefined);
          }}
        >
          Save rubric
        </Button>
      </DialogContent>
    </Dialog>
  );
  const finishDialogs = (
    <>
      <ConfirmAction
        open={scorePrompt}
        title="This station needs a score"
        description="Enter a score or turn on Not scored before finishing feedback."
        confirmLabel="OK"
        onOpenChange={setScorePrompt}
        onConfirm={() => setScorePrompt(false)}
      />
      <ConfirmAction
        open={blankFeedback !== null}
        title="Some feedback is blank"
        description={blankFeedback ? blankFeedbackCopy(blankFeedback) : ""}
        confirmLabel="Finish anyway"
        onOpenChange={(open) => {
          if (!open) setBlankFeedback(null);
        }}
        onConfirm={() => {
          setBlankFeedback(null);
          onFinishFeedback?.();
        }}
      />
    </>
  );
  const setScore = (score: number | null) =>
    update({ ...draft, score, notAssessedReason: null });
  const setNotScored = (checked: boolean) =>
    update({
      ...draft,
      score: null,
      notAssessedReason: checked ? INTERVIEW_NOT_SCORED : null,
    });
  const questionText = question
    ? interviewText(question.question).replace(/\s+/g, " ").trim()
    : "";
  const canWriteFeedback =
    round.phase === "reading" ||
    round.phase === "questions" ||
    round.phase === "feedback";
  const revisionNotice = newerRevision ? (
    <div
      role="alert"
      className="space-y-3 rounded-xl bg-amber-500/10 p-4 text-sm"
    >
      <p>
        Another saved revision is available. Your draft is still shown below.
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => {
            if (
              window.confirm("Discard this draft and load the saved revision?")
            )
              loadSaved();
          }}
        >
          Load saved version
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (
              window.confirm(
                "Replace the saved revision with your current draft?",
              )
            )
              keepDraft();
          }}
        >
          Keep my draft
        </Button>
      </div>
    </div>
  ) : null;
  return (
    <>
      <div className="space-y-5">
        {leading}
        <InterviewPanel
          title="Station feedback"
          action={<FeedbackSaveStatus state={state} />}
          className="space-y-5"
        >
          <InterviewError
            error={error}
            retry={() => void flush().catch(() => undefined)}
          />
          {recoveryUnavailable && (
            <p
              role="status"
              className="text-sm text-amber-700 dark:text-amber-300"
            >
              Local recovery is unavailable. Online saving still works; wait for
              Saved before leaving or refreshing.
            </p>
          )}
          {revisionNotice}
          <LockedEntry locked={!canWriteFeedback}>
            <ScoreControl
              id={`score-${attempt.id}`}
              maximumPoints={station.maximumPoints}
              score={draft.score}
              notScored={notScored}
              disabled={!canWriteFeedback}
              onScore={setScore}
              onNotScored={setNotScored}
            />
          </LockedEntry>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">General station feedback</h3>
            <LockedEntry locked={!canWriteFeedback}>
              <InterviewDocument
                value={draft.generalFeedback as JSONContent | null}
                onChange={
                  canWriteFeedback
                    ? (value) => update({ ...draft, generalFeedback: value })
                    : undefined
                }
                placeholder="Write overall feedback for this station (optional)…"
              />
            </LockedEntry>
          </div>
        </InterviewPanel>
      </div>
      <InterviewPanel
        title="Question feedback"
        action={<FeedbackSaveStatus state={state} />}
        className="space-y-5"
      >
        <div className="flex flex-wrap gap-2 px-1 pt-1">
          {station.questions.map((item, index) => {
            const unanswered = !interviewText(
              draft.feedback.find(
                (feedback) => feedback.placementId === item.id,
              )?.value ?? null,
            ).trim();
            return (
              <Button
                variant="ghost"
                className={cn(
                  "relative",
                  index === questionIndex && "bg-muted",
                )}
                key={item.id}
                aria-current={index === questionIndex ? "true" : undefined}
                aria-label={
                  unanswered
                    ? `Question ${index + 1}, unanswered`
                    : `Question ${index + 1}`
                }
                onClick={() => setQuestionIndex(index)}
              >
                Question {index + 1}
                {unanswered && (
                  <span
                    aria-hidden
                    className="absolute -right-1 -top-1 size-2.5 rounded-full bg-destructive ring-2 ring-background"
                  />
                )}
              </Button>
            );
          })}
        </div>
        {question && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h3 className="min-w-0 flex-1 font-semibold">
                {questionIndex + 1}. {questionText || "Question"}
              </h3>
              {question.suggestedTimeSeconds ? (
                <RecommendedAnswerTime
                  seconds={question.suggestedTimeSeconds}
                  className="ml-auto shrink-0"
                />
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Question feedback</p>
              <LockedEntry locked={!canWriteFeedback}>
                <InterviewDocument
                  key={question.id}
                  value={(response?.value as JSONContent) ?? null}
                  onChange={
                    canWriteFeedback ? writeQuestionFeedback : undefined
                  }
                  placeholder="Write feedback to mark this question answered…"
                />
              </LockedEntry>
            </div>
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">Rubric</h3>
                <Button
                  variant="outline"
                  className={tutorBtnOutline}
                  onClick={() => {
                    setRubric(question.rubric as JSONContent);
                    setEditingRubricVersion(question.rubricVersion);
                    setEditingRubric(true);
                  }}
                >
                  Edit
                </Button>
              </div>
              {updatedRubricIds.includes(question.id) && (
                <p role="status" className="rounded-lg bg-muted p-3 text-sm">
                  The shared rubric was updated during this interview. You are
                  viewing revision {question.rubricVersion}.
                </p>
              )}
              <InterviewDocument value={question.rubric as JSONContent} />
            </div>
          </div>
        )}
        {rubricDialog}
      </InterviewPanel>
      {finishDialogs}
    </>
  );
}

export function StationMaterials({
  station,
}: {
  station: InterviewSnapshotStation;
}) {
  const [questionIndex, setQuestionIndex] = useState(0);
  const question = station.questions[questionIndex];
  const questionText = question
    ? interviewText(question.question).replace(/\s+/g, " ").trim()
    : "";
  return (
    <>
      <div className="space-y-5">
        <InterviewPanel title="Reading prompt">
          <InterviewDocument value={station.prompt as JSONContent} />
        </InterviewPanel>
        <InterviewPanel title="Station feedback" className="space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-sm">Score</span>
            <LockedEntry locked>
              <Input
                className="w-24"
                type="number"
                value=""
                disabled
                readOnly
              />
            </LockedEntry>
            <span className="text-sm text-muted-foreground">
              / {station.maximumPoints}
            </span>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">General station feedback</h3>
            <LockedEntry locked>
              <InterviewDocument
                value={null}
                placeholder="Write overall feedback for this station (optional)…"
              />
            </LockedEntry>
          </div>
        </InterviewPanel>
      </div>
      <InterviewPanel title="Question feedback" className="space-y-5">
        <div className="flex flex-wrap gap-2 px-1 pt-1">
          {station.questions.map((item, index) => (
            <Button
              variant="ghost"
              className={cn("relative", index === questionIndex && "bg-muted")}
              key={item.id}
              aria-current={index === questionIndex ? "true" : undefined}
              aria-label={`Question ${index + 1}, unanswered`}
              onClick={() => setQuestionIndex(index)}
            >
              Question {index + 1}
              <span
                aria-hidden
                className="absolute -right-1 -top-1 size-2.5 rounded-full bg-destructive ring-2 ring-background"
              />
            </Button>
          ))}
        </div>
        {question && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <h3 className="min-w-0 flex-1 font-semibold">
                {questionIndex + 1}. {questionText || "Question"}
              </h3>
              {question.suggestedTimeSeconds ? (
                <RecommendedAnswerTime
                  seconds={question.suggestedTimeSeconds}
                  className="ml-auto shrink-0"
                />
              ) : null}
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Question feedback</p>
              <LockedEntry locked>
                <InterviewDocument
                  value={null}
                  placeholder="Write feedback to mark this question answered…"
                />
              </LockedEntry>
            </div>
            <div className="space-y-3 border-t pt-4">
              <h3 className="font-semibold">Rubric</h3>
              <InterviewDocument value={question.rubric as JSONContent} />
            </div>
          </div>
        )}
      </InterviewPanel>
    </>
  );
}
