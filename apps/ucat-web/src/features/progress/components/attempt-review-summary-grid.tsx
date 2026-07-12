"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { SegmentedControl } from "@/features/progress/components/segmented-control";
import {
  UCAT_CARD_CHROME,
  UCAT_CARD_CONTENT_AFTER_HEADER,
  UCAT_CARD_HEADER_ROW,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import {
  SetAttemptAnalysisChart,
  type QuestionAttemptForChart,
} from "./set-attempt-analysis-chart";
import { AttemptReviewScoreCard } from "./attempt-review-score-card";
import { PercentileCard } from "./percentile-card";
import {
  AttemptReviewTimingCard,
  type AttemptReviewExamTimingMetrics,
  type AttemptReviewPracticeTimingMetrics,
} from "./attempt-review-timing-card";
import type { CategoryBreakdownEntry } from "../lib/compute-category-breakdown";
import { ATTEMPT_CHART_RESULT_COLORS } from "../lib/attempt-chart-result-colors";
import { computeQuestionAttemptResult } from "../lib/compute-question-attempt-result";

type AttemptReviewSummaryGridProps = {
  points: number;
  total: number;
  scaledScore?: number | null;
  categoryBreakdown: CategoryBreakdownEntry[];
  chartData: QuestionAttemptForChart[];
  selectedQuestionIndex: number;
  onBarClick: (index: number) => void;
  /** When set, uses Score | Timing on top and full-width question attempts below. */
  timing?: AttemptReviewExamTimingMetrics;
  /** Practice-session timing (session time + avg / question). */
  practiceTiming?: AttemptReviewPracticeTimingMetrics;
};

function QuestionAttemptsCard({
  chartData,
  selectedQuestionIndex,
  onBarClick,
}: {
  chartData: QuestionAttemptForChart[];
  selectedQuestionIndex: number;
  onBarClick: (index: number) => void;
}) {
  const [navigatorView, setNavigatorView] = useState<"simple" | "timing">(
    "timing",
  );
  const groupedQuestions = chartData.reduce<
    Array<{
      stemIndex: number | null;
      questions: Array<QuestionAttemptForChart & { index: number }>;
    }>
  >((groups, question, index) => {
    const stemIndex = question.stemIndex ?? null;
    const last = groups[groups.length - 1];
    if (!last || last.stemIndex !== stemIndex) {
      groups.push({ stemIndex, questions: [{ ...question, index }] });
    } else {
      last.questions.push({ ...question, index });
    }
    return groups;
  }, []);

  return (
    <Card
      id="tour-attempt-navigator"
      className={cn(UCAT_CARD_CHROME, "min-w-0 overflow-hidden")}
    >
      <CardHeader className={UCAT_CARD_HEADER_ROW}>
        <CardTitle className="text-base font-medium">
          Question attempts
        </CardTitle>
        <SegmentedControl
          value={navigatorView}
          onValueChange={setNavigatorView}
          options={[
            { value: "simple", label: "Simple" },
            { value: "timing", label: "Timing graph" },
          ]}
        />
      </CardHeader>
      <CardContent
        className={cn(
          "min-w-0 overflow-hidden",
          UCAT_CARD_CONTENT_AFTER_HEADER,
        )}
      >
        {navigatorView === "timing" ? (
          <SetAttemptAnalysisChart
            data={chartData}
            selectedQuestionIndex={selectedQuestionIndex}
            onBarClick={onBarClick}
          />
        ) : (
          <div className="min-w-0 pb-1">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
              {groupedQuestions.map((group, groupIndex) => (
                <div
                  key={`${group.stemIndex ?? "none"}-${groupIndex}`}
                  className="flex flex-col items-center gap-1"
                >
                  <div className="flex flex-wrap justify-center gap-1">
                    {group.questions.map((question) => {
                      const result =
                        question.score != null
                          ? computeQuestionAttemptResult({
                              score: question.score,
                              questionType: question.questionType ?? null,
                              hasAttempt: question.result !== "not_attempted",
                            })
                          : question.result;
                      const selected = question.index === selectedQuestionIndex;
                      const isNotAttempted = result === "not_attempted";
                      return (
                        <button
                          key={`${question.questionNumber}-${question.index}`}
                          type="button"
                          onClick={() => onBarClick(question.index)}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-md text-sm font-semibold tabular-nums transition",
                            selected ? "shadow-sm opacity-100" : "opacity-45",
                            isNotAttempted
                              ? "bg-muted text-muted-foreground"
                              : "text-white hover:ring-2 hover:ring-primary/30",
                          )}
                          style={
                            isNotAttempted
                              ? undefined
                              : {
                                  backgroundColor:
                                    ATTEMPT_CHART_RESULT_COLORS[result],
                                }
                          }
                        >
                          {question.questionNumber}
                        </button>
                      );
                    })}
                  </div>
                  {group.stemIndex != null ? (
                    <span className="text-[10px] font-medium text-muted-foreground">
                      Stem {group.stemIndex}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AttemptReviewSummaryGrid({
  points,
  total,
  scaledScore,
  categoryBreakdown,
  chartData,
  selectedQuestionIndex,
  onBarClick,
  timing,
  practiceTiming,
}: AttemptReviewSummaryGridProps) {
  const scoreCard = (
    <AttemptReviewScoreCard
      points={points}
      total={total}
      scaledScore={scaledScore}
      categoryBreakdown={categoryBreakdown}
    />
  );

  const questionAttemptsCard = (
    <QuestionAttemptsCard
      chartData={chartData}
      selectedQuestionIndex={selectedQuestionIndex}
      onBarClick={onBarClick}
    />
  );
  const percentileCard = (
    <PercentileCard scaledScore={scaledScore} scope="section" />
  );

  if (timing != null || practiceTiming != null) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          {scoreCard}
          {percentileCard}
          {practiceTiming != null ? (
            <AttemptReviewTimingCard
              scopeLabel="practice"
              timing={practiceTiming}
            />
          ) : timing != null ? (
            <AttemptReviewTimingCard timing={timing} />
          ) : null}
        </div>
        {questionAttemptsCard}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {questionAttemptsCard}
      <div className="grid gap-4 sm:grid-cols-2">
        {scoreCard}
        {percentileCard}
      </div>
    </div>
  );
}
