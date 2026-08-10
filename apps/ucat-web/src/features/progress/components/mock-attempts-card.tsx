"use client";

import { useId, useMemo, useState } from "react";
import { format } from "date-fns";
import Link from "next/link";
import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@altitutor/ui";
import { lookupUcatAnzTotalPercentile } from "@altitutor/ucat-percentiles";
import type { MockAttemptRow } from "@altitutor/shared";
import { AttemptMetricColumnHeader } from "./attempt-metric-column-header";
import { ProgressTablePagination } from "./progress-table-pagination";
import { UcatTableRowActionLink } from "./ucat-table-row-action-link";
import { ProgressGraph, type GraphDataType } from "./progress-graph";
import {
  formatAttemptTableMetricValue,
  getAttemptTableMetricColumn,
  type AttemptTableMetric,
} from "../lib/attempt-table-metric";
import type { GraphDateRange } from "../lib/progress-mode";
import { ProgressClearFilterButton } from "./progress-clear-filter-button";
import { useProgressSeries } from "../hooks/use-progress-series";
import { buildDailyProgressGraphData } from "../lib/daily-progress-series";
import { useProgressAttempts } from "../hooks/use-progress-attempts";
import type { MockProgressResponse } from "../types/mock-progress";
import { calculateRecentWeightedMockScore } from "../lib/mock-progress-insights";
import { buildMockTrajectoryInsight } from "../lib/mock-trajectory-insight";
import { ContentRatingControls } from "@/features/content-ratings/components/content-rating-controls";
import { contentSnapshotVersion } from "@/features/content-ratings/lib";
import {
  UCAT_CARD_CHROME,
  UCAT_FLOATING_GRAPH_CARD,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  UCAT_TABLE_BODY_ROW,
  UCAT_TABLE_HEADER_CLASSNAME,
  UCAT_TABLE_HEADER_ROW,
  UCAT_TABLE_SHELL,
} from "@/lib/ucat-surface-motion";

const GRAPH_DATA_TYPES: { value: GraphDataType; label: string }[] = [
  { value: "scaled_score", label: "Scaled score" },
  { value: "percentage", label: "Accuracy" },
  { value: "time_taken", label: "Time taken" },
  { value: "exam_speed", label: "Exam speed" },
];

const TABLE_METRICS: { value: AttemptTableMetric; label: string }[] = [
  { value: "raw_score", label: "Raw score" },
  { value: "scaled_score", label: "Scaled score" },
  { value: "time_taken", label: "Time taken" },
  { value: "exam_speed", label: "Exam speed" },
];

const MOCK_ATTEMPTS_PAGE_SIZE = 8;

export function MockAttemptsCard({
  summary,
}: {
  summary: MockProgressResponse;
}) {
  const [graphDataType, setGraphDataType] =
    useState<GraphDataType>("scaled_score");
  const [tableMetric, setTableMetric] =
    useState<AttemptTableMetric>("scaled_score");
  const [dateRange, setDateRange] = useState<GraphDateRange>("all");
  const [page, setPage] = useState(1);
  const seriesQuery = useProgressSeries("mock");
  const attemptsQuery = useProgressAttempts({
    source: "mock",
    page,
    pageSize: MOCK_ATTEMPTS_PAGE_SIZE,
    dateRange,
  });
  const filteredAttempts = (attemptsQuery.data?.attempts ??
    []) as MockAttemptRow[];
  const mockYAxisMax = Math.max(
    ...filteredAttempts.map((attempt) =>
      Math.max(attempt.scaledScoreMax ?? 0, attempt.scaledScore ?? 0),
    ),
    2700,
  );
  const graphData = useMemo(
    () =>
      buildDailyProgressGraphData(
        seriesQuery.data?.points ?? [],
        graphDataType,
        dateRange,
      ),
    [dateRange, graphDataType, seriesQuery.data?.points],
  );
  const scoreValues = graphData.flatMap((point) =>
    point.value == null ? [] : [point.value],
  );
  const trend =
    scoreValues.length > 1
      ? Math.round(scoreValues.at(-1)! - scoreValues[0]!)
      : null;
  const recentWeightedAverage = calculateRecentWeightedMockScore(
    seriesQuery.data?.points ?? [],
  );
  const benchmark = lookupUcatAnzTotalPercentile(recentWeightedAverage);
  const insight = buildMockTrajectoryInsight({ trend });
  const displayedInsight = { title: insight.title, body: insight.body };
  const attemptsTableTitleId = useId();
  const metricColumn = getAttemptTableMetricColumn(tableMetric, "mock");

  return (
    <div className="space-y-6">
      <section className="relative isolate overflow-hidden border-b border-border/50 bg-gradient-to-b from-background via-muted/15 to-background px-5 py-6 sm:px-8 lg:px-10">
        <div className="relative min-h-[430px]">
          <ProgressGraph
            data={graphData}
            type="bar"
            dataType={graphDataType}
            dateRange={dateRange}
            onDateRangeChange={(range) => {
              setDateRange(range);
              setPage(1);
            }}
            isMockContext
            yAxisMax={
              graphDataType === "scaled_score" ? mockYAxisMax : undefined
            }
            metricOptions={GRAPH_DATA_TYPES}
            onDataTypeChange={setGraphDataType}
            trailingSpace
            emptyMessage="Mock attempts will appear here"
            emptyDescription="Complete a mock to start building your score history."
          />

          <aside
            className={cn(
              UCAT_FLOATING_GRAPH_CARD,
              "mt-4 p-5 lg:absolute lg:right-0 lg:top-2 lg:mt-0 lg:w-[390px]",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              Mock insight
            </p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Weighted average
                </p>
                <p className="text-4xl font-semibold tabular-nums">
                  {recentWeightedAverage ?? "Pending"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Percentile</p>
                <p className="font-medium">
                  {benchmark.percentileLabel ?? "Not available"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {insight.body}
            </p>
            <ContentRatingControls
              className="mt-3"
              descriptor={{
                targetType: "progress_insight",
                targetKey: insight.ruleId,
                targetVersion: contentSnapshotVersion(displayedInsight),
                contextKey: `progress:mocks:${dateRange}`,
                surface: "progress",
                displayedContent: displayedInsight,
              }}
            />
            <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
              {summary.sections
                .filter((section) => section.sectionNumber <= 3)
                .map((section) => (
                  <div
                    key={section.sectionId}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="truncate text-muted-foreground">
                      {section.sectionName}
                    </span>
                    <span className="font-medium tabular-nums">
                      {section.averageScaledScore ?? "Pending"}
                    </span>
                  </div>
                ))}
            </div>
            {summary.attemptCount === 0 ? (
              <Button asChild className="mt-5 w-full">
                <Link href="/mocks">Go to mocks</Link>
              </Button>
            ) : null}
          </aside>
        </div>
      </section>

      <section
        aria-label="Mock progress summary"
        className="mx-auto grid w-full max-w-[1400px] gap-4 px-5 sm:grid-cols-2 sm:px-6"
      >
        <Card className={UCAT_CARD_CHROME}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Mocks completed</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {summary.attemptCount}
            </p>
          </CardContent>
        </Card>
        <Card className={UCAT_CARD_CHROME}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Average mock score</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {summary.averageScaledScore ?? "Pending"}
            </p>
          </CardContent>
        </Card>
      </section>

      <section
        aria-labelledby={attemptsTableTitleId}
        className="mx-auto w-full max-w-[1400px] space-y-4 px-5 sm:px-6"
      >
        <h2
          id={attemptsTableTitleId}
          className="text-xl font-semibold tracking-tight"
        >
          Mock attempts
        </h2>
        <div className={UCAT_TABLE_SHELL}>
          <Table>
            <TableHeader className={UCAT_TABLE_HEADER_CLASSNAME}>
              <TableRow className={UCAT_TABLE_HEADER_ROW}>
                <TableHead>Date</TableHead>
                <TableHead>Mock</TableHead>
                <AttemptMetricColumnHeader
                  options={TABLE_METRICS}
                  value={tableMetric}
                  onValueChange={setTableMetric}
                  label={metricColumn.label}
                  tooltip={metricColumn.tooltip}
                />
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAttempts.length === 0 ? (
                <TableRow className={UCAT_TABLE_BODY_ROW}>
                  <TableCell colSpan={4} className="py-8 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-muted-foreground">
                        No submitted mock attempts yet
                      </p>
                      {dateRange !== "all" ? (
                        <ProgressClearFilterButton
                          onClick={() => setDateRange("all")}
                        />
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAttempts.map((attempt) => {
                  const date = attempt.completedAt ?? attempt.attemptedAt;
                  return (
                    <TableRow key={attempt.id} className={UCAT_TABLE_BODY_ROW}>
                      <TableCell>
                        {date ? format(new Date(date), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell>{attempt.mockName ?? "—"}</TableCell>
                      <TableCell>
                        {formatAttemptTableMetricValue(
                          tableMetric,
                          {
                            scaledScore: attempt.scaledScore,
                            scaledScoreMax: attempt.scaledScoreMax,
                            scorePoints: attempt.scorePoints,
                            totalPoints: attempt.totalPoints,
                            rawScoreBreakdown: attempt.rawScoreBreakdown,
                            timeTakenSeconds: attempt.timeTakenSeconds,
                            setTimeLimitSeconds: attempt.setTimeLimitSeconds,
                            studentExamSpeed: attempt.studentExamSpeed,
                          },
                          "mock",
                        )}
                      </TableCell>
                      <TableCell>
                        <UcatTableRowActionLink
                          href={`/progress/mocks/mock-attempts/${attempt.id}`}
                          label="View attempt"
                          unreviewed={attempt.reviewCompletedAt == null}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <ProgressTablePagination
          page={page}
          pageSize={MOCK_ATTEMPTS_PAGE_SIZE}
          total={attemptsQuery.data?.total ?? 0}
          onPageChange={setPage}
          showPageSizeSelector={false}
          isFetching={attemptsQuery.isFetching}
        />
      </section>
    </div>
  );
}
