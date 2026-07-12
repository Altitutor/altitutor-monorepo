"use client";

import { useId, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@altitutor/ui";
import { AttemptMetricColumnHeader } from "./attempt-metric-column-header";
import { ProgressTablePagination } from "./progress-table-pagination";
import { UcatTableRowActionLink } from "./ucat-table-row-action-link";
import { GraphTypeTabs } from "./graph-type-tabs";
import { format } from "date-fns";
import { ProgressGraph, type GraphDataType } from "./progress-graph";
import {
  formatAttemptTableMetricValue,
  getAttemptTableMetricColumn,
  resolveAttemptTableMetric,
} from "../lib/attempt-table-metric";
import type { MockAttemptRow } from "@altitutor/shared";
import {
  UCAT_CARD_CHROME,
  UCAT_CARD_CONTENT_AFTER_HEADER,
  UCAT_CARD_HEADER_ROW,
  UCAT_TABLE_BODY_ROW,
  UCAT_TABLE_HEADER_CLASSNAME,
  UCAT_TABLE_HEADER_ROW,
  UCAT_TABLE_SHELL,
} from "@/lib/ucat-surface-motion";
import type { GraphDateRange } from "../lib/progress-mode";
import { ProgressClearFilterButton } from "./progress-clear-filter-button";
import { useProgressSeries } from "../hooks/use-progress-series";
import { buildDailyProgressGraphData } from "../lib/daily-progress-series";
import { useProgressAttempts } from "../hooks/use-progress-attempts";

const GRAPH_DATA_TYPES: { value: GraphDataType; label: string }[] = [
  { value: "scaled_score", label: "Scaled score" },
  { value: "percentage", label: "Percentage" },
  { value: "time_taken", label: "Time taken" },
  { value: "exam_speed", label: "Exam speed" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function MockAttemptsCard() {
  const [graphDataType, setGraphDataType] =
    useState<GraphDataType>("scaled_score");
  const [graphType, setGraphType] = useState<"line" | "bar">("line");
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
  const filteredAttempts = (attemptsQuery.data?.attempts ?? []) as MockAttemptRow[];

  const mockYAxisMax = Math.max(
    ...filteredAttempts.map((a) => a.scaledScoreMax ?? a.scaledScore ?? 0),
    900,
  );

  const handleDateRangeChange = (nextRange: GraphDateRange) => {
    setDateRange(nextRange);
    setPage(1);
  };

  const graphData = useMemo(() => {
    return buildDailyProgressGraphData(
      seriesQuery.data?.points ?? [],
      graphDataType,
      dateRange,
    );
  }, [
    graphDataType,
    dateRange,
    seriesQuery.data?.points,
  ]);

  const attemptsTableTitleId = useId();
  const tableMetric = resolveAttemptTableMetric(graphDataType);
  const metricColumn = getAttemptTableMetricColumn(tableMetric, "mock");

  return (
    <div className="space-y-6">
      <Card className={UCAT_CARD_CHROME}>
        <CardHeader className={UCAT_CARD_HEADER_ROW}>
          <CardTitle>Mock attempts</CardTitle>
          <GraphTypeTabs value={graphType} onValueChange={setGraphType} />
        </CardHeader>
        <CardContent className={UCAT_CARD_CONTENT_AFTER_HEADER}>
          <ProgressGraph
            data={graphData}
            type={graphType}
            dataType={graphDataType}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            isMockContext
            yAxisMax={
              graphDataType === "scaled_score" ? mockYAxisMax : undefined
            }
            metricOptions={GRAPH_DATA_TYPES}
            onDataTypeChange={setGraphDataType}
          />
        </CardContent>
      </Card>
      <section
        aria-labelledby={attemptsTableTitleId}
        className="space-y-4"
      >
        <h2
          id={attemptsTableTitleId}
          className="text-2xl font-semibold tracking-tight"
        >
          All mock attempts
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
                            onClick={() => handleDateRangeChange("all")}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAttempts.map((a) => {
                    const dateStr = a.completedAt
                      ? format(new Date(a.completedAt), "dd MMM yyyy")
                      : format(new Date(a.attemptedAt), "dd MMM yyyy");

                    return (
                      <TableRow key={a.id} className={UCAT_TABLE_BODY_ROW}>
                        <TableCell>{dateStr}</TableCell>
                        <TableCell>{a.mockName ?? "—"}</TableCell>
                        <TableCell>
                          {formatAttemptTableMetricValue(
                            tableMetric,
                            {
                              scaledScore: a.scaledScore,
                              scaledScoreMax: a.scaledScoreMax,
                              scorePoints: a.scorePoints,
                              totalPoints: a.totalPoints,
                              timeTakenSeconds: a.timeTakenSeconds,
                              setTimeLimitSeconds: a.setTimeLimitSeconds,
                              studentExamSpeed: a.studentExamSpeed,
                            },
                            "mock",
                          )}
                        </TableCell>
                        <TableCell>
                          <UcatTableRowActionLink
                            href={`/progress/mocks/mock-attempts/${a.id}`}
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
        {filteredAttempts.length > 0 ? (
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
        ) : null}
      </section>
    </div>
  );
}
