"use client";

import { useEffect, useMemo, useState, type ClipboardEvent } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UCAT_CARD_CHROME, UCAT_HEADER_ICON_BUTTON } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useQuestionEngineData } from "@/features/question-engine/hooks/use-question-engine-data";
import { useRefreshedContentCache } from "@/features/question-engine/hooks/use-refreshed-content-cache";
import { ResultsQuestionViewer } from "@/features/question-engine/components/results-question-viewer";
import { computeMarkingResult } from "@/features/question-engine/components/marking-body";
import type { QuestionEngineExam } from "@/features/question-engine/model/types";

type QuestionAttemptForCard = {
  questionId: string;
  questionAnswerOptionId?: string | null;
  answerSnapshot?: Record<string, boolean> | null;
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

  const questions = useMemo(() => exam?.questions ?? [], [exam?.questions]);

  useEffect(() => {
    const clamped = Math.max(
      0,
      Math.min(initialQuestionIndex, Math.max(0, questions.length - 1)),
    );
    setViewingIndex(clamped);
  }, [initialQuestionIndex, questions.length]);

  const currentQuestion = questions[viewingIndex];
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
        <div
          className={cn(
            attemptReview
              ? "select-none"
              : "flex h-[480px] min-h-[200px] flex-col overflow-hidden rounded-ucatControl bg-muted/40 p-4 dark:bg-muted/25",
          )}
          {...(attemptReview
            ? {
                onCopy: (e: ClipboardEvent) => e.preventDefault(),
                onCut: (e: ClipboardEvent) => e.preventDefault(),
                onPaste: (e: ClipboardEvent) => e.preventDefault(),
              }
            : {})}
        >
          {currentQuestion && (
            <div
              className={attemptReview ? undefined : "min-h-0 flex-1 overflow-hidden"}
            >
              <ResultsQuestionViewer
                question={currentQuestion}
                selectedOptionId={selectedAnswers[currentQuestion.id]}
                correctOptionId={currentQuestion.correctOptionId}
                points={points}
                syllogismSnapshot={syllogismSnapshots[currentQuestion.id]}
                preloadedContent={getCachedContent(currentQuestion.id)}
                variant={attemptReview ? "site" : "ucat"}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
