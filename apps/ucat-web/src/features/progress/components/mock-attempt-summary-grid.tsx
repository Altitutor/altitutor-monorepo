"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@altitutor/ui";
import { UCAT_CARD_CHROME, UCAT_DIVIDER_TOP } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import type { MockSetInfo } from "@/app/api/ucat/progress/mock-attempts/[id]/route";
import {
  MockAttemptAnalysisChart,
  type MockQuestionAttemptForChart,
} from "./mock-attempt-analysis-chart";
import {
  AnimatedFraction,
  AnimatedInteger,
} from "./progress-animated-display";
import { UcatTableRowActionLink } from "./ucat-table-row-action-link";

type MockAttemptSummaryGridProps = {
  scaledScore: number | null;
  scaledScoreMax: number | null;
  sets: MockSetInfo[];
  mockAttemptId: string;
  chartData: MockQuestionAttemptForChart[];
  setBoundaryIndices: number[];
  selectedQuestionIndex: number;
  onBarClick: (index: number) => void;
};

export function MockAttemptSummaryGrid({
  scaledScore,
  scaledScoreMax,
  sets,
  mockAttemptId,
  chartData,
  setBoundaryIndices,
  selectedQuestionIndex,
  onBarClick,
}: MockAttemptSummaryGridProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <Card className={cn(UCAT_CARD_CHROME, "h-full")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">
            Overall scaled score
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div
            className={cn(
              "text-3xl font-bold tabular-nums",
              scaledScore == null && "text-muted-foreground",
            )}
          >
            {scaledScore != null && scaledScoreMax != null ? (
              <AnimatedFraction
                numerator={Math.round(scaledScore)}
                denominator={scaledScoreMax}
              />
            ) : scaledScore != null ? (
              <AnimatedInteger value={Math.round(scaledScore)} />
            ) : (
              "—"
            )}
          </div>
          {sets.length > 0 ? (
            <div className={cn(UCAT_DIVIDER_TOP, "mt-3 pt-3")}>
              <div className="mb-2 text-xs font-medium text-muted-foreground">
                Sets
              </div>
              <div className="flex flex-col gap-2">
                {sets.map((set) => {
                  const total = set.totalPoints ?? 0;
                  const points = set.scorePoints ?? 0;
                  const href = set.setAttemptId
                    ? `/progress/mock-attempts/${mockAttemptId}/sets/${set.setAttemptId}`
                    : null;

                  return (
                    <div
                      key={set.setAttemptId || set.questionSetId}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-muted-foreground">
                          {set.questionSetName ?? "Set"}
                        </div>
                        <div className="tabular-nums">
                          {total > 0 ? (
                            <AnimatedFraction
                              numerator={points}
                              denominator={total}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {set.scaledScore != null ? (
                            <span className="text-muted-foreground">
                              {" "}
                              ·{" "}
                              <AnimatedInteger
                                value={Math.round(set.scaledScore)}
                              />
                              /900
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {href ? (
                        <UcatTableRowActionLink href={href} label="View set" />
                      ) : null}
                    </div>
                  );
                })}
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
          <MockAttemptAnalysisChart
            data={chartData}
            setBoundaryIndices={setBoundaryIndices}
            sets={sets.map((s) => ({
              questionSetName: s.questionSetName,
            }))}
            selectedQuestionIndex={selectedQuestionIndex}
            onBarClick={onBarClick}
          />
        </CardContent>
      </Card>
    </div>
  );
}
