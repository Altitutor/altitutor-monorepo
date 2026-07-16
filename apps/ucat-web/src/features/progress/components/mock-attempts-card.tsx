"use client";

import { useId, useMemo, useState } from "react";
import { format } from "date-fns";
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
  resolveAttemptTableMetric,
} from "../lib/attempt-table-metric";
import type { GraphDateRange } from "../lib/progress-mode";
import { ProgressClearFilterButton } from "./progress-clear-filter-button";
import { useProgressSeries } from "../hooks/use-progress-series";
import { buildDailyProgressGraphData } from "../lib/daily-progress-series";
import { useProgressAttempts } from "../hooks/use-progress-attempts";
import type { MockProgressResponse } from "../types/mock-progress";
import { calculateRecentWeightedMockScore } from "../lib/mock-progress-insights";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
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

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function MockAttemptsCard({
  summary,
}: {
  summary: MockProgressResponse;
}) {
  const [graphDataType, setGraphDataType] =
    useState<GraphDataType>("scaled_score");
  const [dateRange, setDateRange] = useState<GraphDateRange>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const seriesQuery = useProgressSeries("mock");
  const attemptsQuery = useProgressAttempts({
    source: "mock",
    page,
    pageSize,
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
  const attemptsTableTitleId = useId();
  const tableMetric = resolveAttemptTableMetric(graphDataType);
  const metricColumn = getAttemptTableMetricColumn(tableMetric, "mock");

  return (
    <div className="space-y-6">
      <section className="relative isolate overflow-hidden border-b border-border/50 bg-gradient-to-b from-background via-muted/15 to-background px-5 py-6 sm:px-8 lg:px-10">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Mock progress
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Full-mock scores over time, with the most useful context beside the
            chart.
          </p>
        </div>
        <div className="relative mt-3 min-h-[430px]">
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
          />

          <aside className="mt-4 rounded-2xl border border-border/70 bg-card/94 p-5 shadow-xl backdrop-blur-xl lg:absolute lg:right-0 lg:top-2 lg:mt-0 lg:w-[390px]">
            <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
              Mock insight
            </p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Recent-weighted average
                </p>
                <p className="text-4xl font-semibold tabular-nums">
                  {recentWeightedAverage ?? "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">UCAT ANZ</p>
                <p className="font-medium">
                  {benchmark.percentileLabel ?? "Not available"}
                </p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              {trend == null
                ? "Complete at least two mocks to reveal whether your exam-day performance is improving."
                : trend > 0
                  ? `Your recent mock trajectory is up ${trend} points across the selected period. Check the section breakdown to see whether that improvement is balanced.`
                  : trend < 0
                    ? `Your recent mock trajectory is down ${Math.abs(trend)} points. Review timing and section-level misses before the next mock.`
                    : "Your mock scores are stable. Section-level review is the best way to find the next gain."}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Recent mocks carry more weight, with influence halving every 60
              days. The simple average is shown below.
            </p>
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
                      {section.averageScaledScore ?? "—"}
                    </span>
                  </div>
                ))}
            </div>
          </aside>
        </div>
      </section>

      <section
        aria-label="Mock progress summary"
        className="mx-auto grid w-full max-w-[1400px] gap-4 px-5 sm:grid-cols-3 sm:px-6"
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
              {summary.averageScaledScore ?? "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Simple average across completed mocks
            </p>
          </CardContent>
        </Card>
        <Card className={UCAT_CARD_CHROME}>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Unreviewed attempts</p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {summary.unreviewedAttemptCount}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Mocks without a completed review
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
                  options={GRAPH_DATA_TYPES}
                  value={graphDataType}
                  onValueChange={setGraphDataType}
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
          pageSize={pageSize}
          total={attemptsQuery.data?.total ?? 0}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          isFetching={attemptsQuery.isFetching}
        />
      </section>
    </div>
  );
}
