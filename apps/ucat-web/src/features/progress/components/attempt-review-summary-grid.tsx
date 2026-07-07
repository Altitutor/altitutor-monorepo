"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
import { SegmentedControl } from "@/features/progress/components/segmented-control";
import { UCAT_CARD_CHROME, UCAT_DIVIDER_TOP } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import {
  SetAttemptAnalysisChart,
  type QuestionAttemptForChart,
} from "./set-attempt-analysis-chart";
import { AnimatedFraction, AnimatedInteger } from "./progress-animated-display";
import type { CategoryBreakdownEntry } from "../lib/compute-category-breakdown";
import { ATTEMPT_CHART_RESULT_COLORS } from "../lib/attempt-chart-result-colors";
import { computeQuestionAttemptResult } from "../lib/compute-question-attempt-result";
import { formatUcatPercentile } from "../lib/percentiles";

type AttemptReviewSummaryGridProps = {
  points: number;
  total: number;
  scaledScore?: number | null;
  categoryBreakdown: CategoryBreakdownEntry[];
  chartData: QuestionAttemptForChart[];
  selectedQuestionIndex: number;
  onBarClick: (index: number) => void;
};

export function AttemptReviewSummaryGrid({
  points,
  total,
  scaledScore,
  categoryBreakdown,
  chartData,
  selectedQuestionIndex,
  onBarClick,
}: AttemptReviewSummaryGridProps) {
  const [navigatorView, setNavigatorView] = useState<"simple" | "timing">(
    "timing",
  );
  const showScaledScore = scaledScore !== undefined;
  const percentile = formatUcatPercentile(scaledScore, "section");
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
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card className={cn(UCAT_CARD_CHROME, "min-w-0 overflow-hidden")}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
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
        <CardContent className="min-w-0 overflow-hidden">
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
                        const selected =
                          question.index === selectedQuestionIndex;
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

      <Card className={cn(UCAT_CARD_CHROME, "h-full")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Score</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {showScaledScore ? (
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                Scaled score
              </div>
              <div
                className={cn(
                  "text-3xl font-bold tabular-nums",
                  scaledScore == null && "text-muted-foreground",
                )}
              >
                {scaledScore != null ? (
                  <AnimatedInteger value={Math.round(scaledScore)} />
                ) : (
                  "—"
                )}
              </div>
              {percentile ? (
                <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <span>{percentile}</span>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex cursor-help text-muted-foreground/80">
                          <Info
                            className="h-3.5 w-3.5"
                            aria-label="Percentile explanation"
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[280px]">
                        Percentile compares this scaled score with the relevant
                        UCAT score distribution. For example, the 80th
                        percentile means the score is higher than about 80% of
                        comparison scores.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              ) : null}
            </div>
          ) : null}
          <div>
            <div className="text-xs font-medium text-muted-foreground">
              Points
            </div>
            <div className="text-xl font-semibold tabular-nums">
              {total > 0 ? (
                <AnimatedFraction numerator={points} denominator={total} />
              ) : (
                "—"
              )}
            </div>
          </div>
          {categoryBreakdown.length > 0 ? (
            <div className={cn(UCAT_DIVIDER_TOP, "mt-3 pt-3")}>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Category breakdown
              </div>
              <div className="flex flex-col gap-1.5">
                {categoryBreakdown.map((cat) => (
                  <div
                    key={cat.name}
                    className="flex justify-between text-sm tabular-nums"
                  >
                    <span className="mr-2 truncate text-muted-foreground">
                      {cat.name}
                    </span>
                    <span className="shrink-0">
                      {cat.total > 0 ? (
                        <AnimatedFraction
                          numerator={cat.score}
                          denominator={cat.total}
                        />
                      ) : (
                        "—"
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
