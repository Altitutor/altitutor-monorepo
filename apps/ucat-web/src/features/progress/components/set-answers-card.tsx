"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ClipboardEvent,
  type ReactNode,
} from "react";
import { ArrowLeft, ArrowRight, Flag, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FeedbackDialog,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import {
  UCAT_CARD_CHROME,
  UCAT_HEADER_ICON_BUTTON,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useQuestionEngineData } from "@/features/question-engine/hooks/use-question-engine-data";
import { useRefreshedContentCache } from "@/features/question-engine/hooks/use-refreshed-content-cache";
import { ResultsQuestionViewer } from "@/features/question-engine/components/results-question-viewer";
import {
  AnswerExplanation,
  hasAnswerExplanation,
  OptionText,
} from "@/features/question-engine/components/question-content";
import { computeMarkingResult } from "@/features/question-engine/components/marking-body";
import type {
  QuestionEngineExam,
  QuestionItem,
} from "@/features/question-engine/model/types";
import { formatTimeSeconds } from "../lib/format-time";

type QuestionAttemptForCard = {
  questionNumber?: number;
  questionId: string;
  questionAnswerOptionId?: string | null;
  answerSnapshot?: Record<string, boolean> | null;
  result?: "correct" | "partial" | "incorrect" | "not_attempted";
  score?: number | null;
  timeSpentSeconds?: number | null;
  averageTimeSeconds?: number | null;
  averageTimeSampleSize?: number;
  timeBurdenSeconds?: number | null;
  difficulty?: number | null;
  questionTags?: Array<string | { name: string; description?: string | null }>;
  categoryName?: string | null;
  categoryDescription?: string | null;
  isFlagged?: boolean;
};

type SetAnswersCardProps = {
  questionSetId?: string;
  /** Mock template id — loads all mock questions for review. */
  mockId?: string;
  questionAttempts: QuestionAttemptForCard[];
  initialQuestionIndex?: number;
  onQuestionIndexChange?: (index: number) => void;
  /** When provided, use this exam instead of fetching by questionSetId. For practice review. */
  exam?: QuestionEngineExam | null;
  /** Attempt review (set/mock/practice): site-themed viewer, natural height, no copy/paste. */
  attemptReview?: boolean;
};

function getQuestionMaxPoints(question: QuestionItem): number {
  return question.questionType === "syllogism" ? 2 : 1;
}

function formatPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}

function isQuestionNotAnswered(
  question: QuestionItem,
  attempt?: QuestionAttemptForCard,
): boolean {
  if (!attempt) return true;
  if (attempt.result === "not_attempted") return true;
  if (question.questionType === "syllogism") {
    return (
      !attempt.answerSnapshot ||
      Object.keys(attempt.answerSnapshot).length === 0
    );
  }
  return !attempt.questionAnswerOptionId;
}

function getAttemptResultBadge(
  attempt: QuestionAttemptForCard | undefined,
  notAnswered: boolean,
): {
  label: string;
  className?: string;
  variant?: "destructive" | "outline";
} | null {
  if (notAnswered || attempt?.result === "not_attempted") {
    return { label: "Not answered", variant: "destructive" };
  }

  if (attempt?.result === "correct") {
    return {
      label: "Correct",
      className:
        "border-transparent bg-emerald-500 text-white hover:bg-emerald-500",
    };
  }

  if (attempt?.result === "partial") {
    return {
      label: "Partially correct",
      variant: "outline",
      className:
        "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }

  if (attempt?.result === "incorrect") {
    return { label: "Incorrect", variant: "destructive" };
  }

  return null;
}

function getTagName(tag: string | { name: string }): string {
  return typeof tag === "string" ? tag : tag.name;
}

function getTagDescription(
  tag: string | { name: string; description?: string | null },
): string | null {
  return typeof tag === "string" ? null : (tag.description ?? null);
}

function DescriptionPill({
  children,
  description,
  variant = "outline",
}: {
  children: ReactNode;
  description?: string | null;
  variant?: "outline" | "secondary";
}) {
  const pill = (
    <Badge variant={variant} className="max-w-full truncate">
      {children}
    </Badge>
  );

  if (!description) return pill;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex max-w-full cursor-help">{pill}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px]">
          {description}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function MeterRow({
  label,
  value,
  max,
  tone = "primary",
}: {
  label: string;
  value: number | null | undefined;
  max: number;
  tone?: "primary" | "muted" | "amber";
}) {
  const pct =
    value != null && max > 0
      ? Math.min(100, Math.max(0, (value / max) * 100))
      : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {value != null ? formatTimeSeconds(value) : "—"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            tone === "amber"
              ? "bg-amber-500"
              : tone === "muted"
                ? "bg-muted-foreground/45"
                : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ExplanationContent({ question }: { question: QuestionItem }) {
  const optionsWithExplanations = question.options.filter((option) =>
    hasAnswerExplanation(option),
  );

  if (!hasAnswerExplanation(question) && optionsWithExplanations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No explanation available.</p>
    );
  }

  return (
    <div className="space-y-3">
      {hasAnswerExplanation(question) ? (
        <AnswerExplanation
          text={question.answerExplanation}
          json={question.answerExplanationJson}
        />
      ) : null}
      {optionsWithExplanations.length > 0 ? (
        <div className="space-y-2">
          {optionsWithExplanations.map((option) => (
            <div
              key={option.id}
              className="rounded-md border border-border p-3"
            >
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                <OptionText option={option} />
              </div>
              <AnswerExplanation
                text={option.answerExplanation}
                json={option.answerExplanationJson}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function SetAnswersCard({
  questionSetId,
  mockId,
  questionAttempts,
  initialQuestionIndex = 0,
  onQuestionIndexChange,
  exam: examProp,
  attemptReview = false,
}: SetAnswersCardProps) {
  const {
    data: examFromQuery,
    isLoading,
    error,
  } = useQuestionEngineData({
    mode: mockId ? "mock" : "set",
    setId: questionSetId ?? "",
    mockId,
    enabled: !examProp && Boolean(mockId || questionSetId),
  });

  const exam = examProp ?? examFromQuery;
  const isLoadingExam = !examProp && isLoading;
  const examError = !examProp && error;

  const { selectedAnswers, syllogismSnapshots } = useMemo(() => {
    const selected: Record<string, string> = {};
    const syllogism: Record<string, Record<string, boolean>> = {};
    for (const a of questionAttempts) {
      if (a.questionAnswerOptionId) {
        selected[a.questionId] = a.questionAnswerOptionId;
      }
      if (a.answerSnapshot && Object.keys(a.answerSnapshot).length > 0) {
        syllogism[a.questionId] = a.answerSnapshot;
      }
    }
    return { selectedAnswers: selected, syllogismSnapshots: syllogism };
  }, [questionAttempts]);

  const [viewingIndex, setViewingIndex] = useState(initialQuestionIndex);
  const [reportOpen, setReportOpen] = useState(false);

  const questions = useMemo(() => exam?.questions ?? [], [exam?.questions]);

  useEffect(() => {
    const clamped = Math.max(
      0,
      Math.min(initialQuestionIndex, Math.max(0, questions.length - 1)),
    );
    setViewingIndex(clamped);
  }, [initialQuestionIndex, questions.length]);

  const currentQuestion = questions[viewingIndex];
  const currentAttempt = questionAttempts[viewingIndex];
  const notAnswered = currentQuestion
    ? isQuestionNotAnswered(currentQuestion, currentAttempt)
    : false;
  const resultBadge = getAttemptResultBadge(currentAttempt, notAnswered);
  const markingResult = useMemo(
    () =>
      questions.length > 0
        ? computeMarkingResult(questions, selectedAnswers, syllogismSnapshots)
        : null,
    [questions, selectedAnswers, syllogismSnapshots],
  );

  const points =
    markingResult && currentQuestion
      ? markingResult.rows[viewingIndex]?.points
      : undefined;

  const getCachedContent = useRefreshedContentCache(questions, viewingIndex);
  const timingMax = Math.max(
    currentAttempt?.timeSpentSeconds ?? 0,
    currentAttempt?.averageTimeSeconds ?? 0,
    currentAttempt?.timeBurdenSeconds ?? 0,
    1,
  );

  const handlePrev = () => {
    const next = Math.max(0, viewingIndex - 1);
    setViewingIndex(next);
    onQuestionIndexChange?.(next);
  };

  const handleNext = () => {
    const next = Math.min(questions.length - 1, viewingIndex + 1);
    setViewingIndex(next);
    onQuestionIndexChange?.(next);
  };

  if (isLoadingExam) {
    return (
      <Card className={cn(UCAT_CARD_CHROME, "overflow-hidden")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Loading questions…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (examError) {
    return (
      <Card className={cn(UCAT_CARD_CHROME, "overflow-hidden")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            {error instanceof Error
              ? error.message
              : "Failed to load questions"}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (questions.length === 0) {
    return (
      <Card className={cn(UCAT_CARD_CHROME, "overflow-hidden")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No questions in this set.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!attemptReview) {
    return (
      <Card className={cn(UCAT_CARD_CHROME, "overflow-hidden")}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Questions</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handlePrev}
              disabled={viewingIndex <= 0}
              className={UCAT_HEADER_ICON_BUTTON}
              aria-label="Previous question"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[80px] text-center text-sm tabular-nums text-muted-foreground">
              {viewingIndex + 1} / {questions.length}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleNext}
              disabled={viewingIndex >= questions.length - 1}
              className={UCAT_HEADER_ICON_BUTTON}
              aria-label="Next question"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex h-[480px] min-h-[200px] flex-col overflow-hidden rounded-ucatControl bg-muted/40 p-4 dark:bg-muted/25">
            {currentQuestion ? (
              <div className="min-h-0 flex-1 overflow-hidden">
                <ResultsQuestionViewer
                  question={currentQuestion}
                  selectedOptionId={selectedAnswers[currentQuestion.id]}
                  correctOptionId={currentQuestion.correctOptionId}
                  points={points}
                  syllogismSnapshot={syllogismSnapshots[currentQuestion.id]}
                  preloadedContent={getCachedContent(currentQuestion.id)}
                />
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]"
      onCopy={(e: ClipboardEvent) => e.preventDefault()}
      onCut={(e: ClipboardEvent) => e.preventDefault()}
      onPaste={(e: ClipboardEvent) => e.preventDefault()}
    >
      <div id="tour-attempt-reviewer" className="min-w-0">
        <Card className={cn(UCAT_CARD_CHROME, "min-w-0 overflow-hidden")}>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
            <div className="min-w-0 space-y-1">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base font-medium">
                <span>
                  Question {viewingIndex + 1} of {questions.length}
                </span>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        {currentAttempt?.isFlagged ? (
                          <Flag
                            className="h-4 w-4 fill-amber-500 text-amber-500"
                            aria-label="Flagged"
                          />
                        ) : (
                          <Flag
                            className="h-4 w-4 text-muted-foreground/45"
                            aria-label="Not flagged"
                          />
                        )}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[240px]">
                      {currentAttempt?.isFlagged
                        ? "You ended this attempt with the question flagged."
                        : "You ended this attempt with the question unflagged."}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  Points: {formatPoints(points ?? currentAttempt?.score ?? 0)} /{" "}
                  {currentQuestion ? getQuestionMaxPoints(currentQuestion) : 1}
                </span>
                {resultBadge ? (
                  <Badge
                    variant={resultBadge.variant}
                    className={cn("rounded-md", resultBadge.className)}
                  >
                    {resultBadge.label}
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handlePrev}
                disabled={viewingIndex <= 0}
                className={UCAT_HEADER_ICON_BUTTON}
                aria-label="Previous question"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleNext}
                disabled={viewingIndex >= questions.length - 1}
                className={UCAT_HEADER_ICON_BUTTON}
                aria-label="Next question"
              >
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {currentQuestion ? (
              <ResultsQuestionViewer
                question={currentQuestion}
                selectedOptionId={selectedAnswers[currentQuestion.id]}
                correctOptionId={currentQuestion.correctOptionId}
                syllogismSnapshot={syllogismSnapshots[currentQuestion.id]}
                preloadedContent={getCachedContent(currentQuestion.id)}
                variant="site"
                showExplanations={false}
                forceSingleColumn
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div id="tour-attempt-explanation" className="min-w-0 space-y-4">
        <Card className={cn(UCAT_CARD_CHROME, "min-w-0")}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
            <CardTitle className="text-base font-medium">
              Answer explanation
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReportOpen(true)}
            >
              <Megaphone className="h-3.5 w-3.5" />
              Report a bug
            </Button>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-relaxed">
            {currentQuestion ? (
              <ExplanationContent question={currentQuestion} />
            ) : null}
          </CardContent>
        </Card>

        <Card className={cn(UCAT_CARD_CHROME, "min-w-0")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Question timing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MeterRow
              label="Your time"
              value={currentAttempt?.timeSpentSeconds}
              max={timingMax}
            />
            {currentAttempt?.averageTimeSeconds != null ? (
              <MeterRow
                label={`Average time`}
                value={currentAttempt.averageTimeSeconds}
                max={timingMax}
                tone="muted"
              />
            ) : null}
            {currentAttempt?.timeBurdenSeconds != null ? (
              <MeterRow
                label="Time burden"
                value={currentAttempt.timeBurdenSeconds}
                max={timingMax}
                tone="amber"
              />
            ) : null}
          </CardContent>
        </Card>

        <Card className={cn(UCAT_CARD_CHROME, "min-w-0")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">
              Question properties
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="shrink-0 text-xs font-medium text-muted-foreground">
                Stem category
              </div>
              {currentAttempt?.categoryName ? (
                <div className="flex min-w-0 justify-end">
                  <DescriptionPill
                    variant="secondary"
                    description={currentAttempt.categoryDescription}
                  >
                    {currentAttempt.categoryName}
                  </DescriptionPill>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="shrink-0 text-xs font-medium text-muted-foreground">
                Question tags
              </div>
              {currentAttempt?.questionTags?.length ? (
                <div className="flex min-w-0 flex-wrap justify-end gap-1.5">
                  {currentAttempt.questionTags.map((tag) => (
                    <DescriptionPill
                      key={getTagName(tag)}
                      description={getTagDescription(tag)}
                    >
                      {getTagName(tag)}
                    </DescriptionPill>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
            {currentAttempt?.difficulty != null ? (
              <div className="flex items-start justify-between gap-4">
                <div className="shrink-0 text-xs font-medium text-muted-foreground">
                  Difficulty
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="text-right text-xs tabular-nums">
                    {currentAttempt.difficulty}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            (currentAttempt.difficulty /
                              (currentAttempt.difficulty > 5 ? 10 : 5)) *
                              100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <FeedbackDialog
        open={reportOpen}
        onOpenChange={setReportOpen}
        kind="bug"
        appName="ucat-web"
        diagnostics={{
          reviewType: "attempt-question-explanation",
          questionId: currentQuestion?.id,
          stemId: currentQuestion?.stemId,
          questionSetId: currentQuestion?.questionSetId,
          questionNumber: viewingIndex + 1,
          selectedOptionId: currentQuestion
            ? selectedAnswers[currentQuestion.id]
            : null,
          answerSnapshot: currentQuestion
            ? syllogismSnapshots[currentQuestion.id]
            : null,
          correctOptionId: currentQuestion?.correctOptionId,
          stemText: currentQuestion?.stemText,
          questionText: currentQuestion?.questionText,
          answerOptions: currentQuestion?.options.map((option) => ({
            id: option.id,
            index: option.index,
            text: option.text,
            isAnswer: option.isAnswer,
            answerExplanation: option.answerExplanation,
          })),
          answerExplanation: currentQuestion?.answerExplanation,
          attempt: currentAttempt,
        }}
      />
    </div>
  );
}
