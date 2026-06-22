"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UCAT_CARD_CHROME, UCAT_DIVIDER_TOP } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import {
  SetAttemptAnalysisChart,
  type QuestionAttemptForChart,
} from "./set-attempt-analysis-chart";
import {
  AnimatedFraction,
  AnimatedInteger,
} from "./progress-animated-display";
import type { CategoryBreakdownEntry } from "../lib/compute-category-breakdown";

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
  const showScaledScore = scaledScore !== undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
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

      <Card className={cn(UCAT_CARD_CHROME, "min-w-0 overflow-hidden")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Question attempts
          </CardTitle>
        </CardHeader>
        <CardContent className="min-w-0 overflow-hidden">
          <SetAttemptAnalysisChart
            data={chartData}
            selectedQuestionIndex={selectedQuestionIndex}
            onBarClick={onBarClick}
          />
        </CardContent>
      </Card>
    </div>
  );
}
