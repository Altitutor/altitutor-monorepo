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
import type { PracticeAttemptRow } from "@altitutor/shared";
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

type PracticeAttemptsCardProps = {
  sectionNumber?: number;
};

const PRACTICE_GRAPH_DATA_TYPES: { value: GraphDataType; label: string }[] = [
  { value: "attempt_count", label: "Number of attempts" },
  { value: "percentage", label: "Percentage" },
  { value: "time_taken", label: "Time taken" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

export function PracticeAttemptsCard({
  sectionNumber,
}: PracticeAttemptsCardProps) {
  const [graphDataType, setGraphDataType] =
    useState<GraphDataType>("percentage");
  const [graphType, setGraphType] = useState<"line" | "bar">("line");
  const [dateRange, setDateRange] = useState<GraphDateRange>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const seriesQuery = useProgressSeries("practice", sectionNumber);
  const attemptsQuery = useProgressAttempts({
    source: "practice",
    page,
    pageSize,
    dateRange,
    sectionNumber,
  });
  const filteredAttempts = (attemptsQuery.data?.attempts ?? []) as PracticeAttemptRow[];
  const metricOptions = PRACTICE_GRAPH_DATA_TYPES;

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
  const tableMetric = resolveAttemptTableMetric(graphDataType, "practice");
  const metricColumn = getAttemptTableMetricColumn(tableMetric, "practice");

  return (
    <div className="space-y-6">
      <Card className={UCAT_CARD_CHROME}>
        <CardHeader className={UCAT_CARD_HEADER_ROW}>
          <CardTitle>Practice sessions</CardTitle>
          <GraphTypeTabs value={graphType} onValueChange={setGraphType} />
        </CardHeader>
        <CardContent className={UCAT_CARD_CONTENT_AFTER_HEADER}>
          <ProgressGraph
            data={graphData}
            type={graphType}
            dataType={graphDataType}
            dateRange={dateRange}
            onDateRangeChange={handleDateRangeChange}
            metricOptions={metricOptions}
            onDataTypeChange={setGraphDataType}
          />
        </CardContent>
      </Card>
      <section aria-labelledby={attemptsTableTitleId} className="space-y-4">
        <h2
          id={attemptsTableTitleId}
          className="text-2xl font-semibold tracking-tight"
        >
          All practice sessions
        </h2>
        <div className={UCAT_TABLE_SHELL}>
          <Table>
            <TableHeader className={UCAT_TABLE_HEADER_CLASSNAME}>
              <TableRow className={UCAT_TABLE_HEADER_ROW}>
                <TableHead>Date</TableHead>
                <TableHead>Section</TableHead>
                <AttemptMetricColumnHeader
                  options={metricOptions}
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
                        No practice sessions yet
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
                    : a.attemptedAt
                      ? format(new Date(a.attemptedAt), "dd MMM yyyy")
                      : "—";
                  return (
                    <TableRow key={a.id} className={UCAT_TABLE_BODY_ROW}>
                      <TableCell>{dateStr}</TableCell>
                      <TableCell className="font-medium">
                        {a.sectionName}
                        {a.unlimited ? " (unlimited)" : ""}
                      </TableCell>
                      <TableCell>
                        {formatAttemptTableMetricValue(
                          tableMetric,
                          {
                            scorePoints: a.scorePoints,
                            totalPoints: a.totalPoints,
                            timeTakenSeconds: a.timeTakenSeconds,
                            questionCount: a.questionCount,
                          },
                          "practice",
                        )}
                      </TableCell>
                      <TableCell>
                        <UcatTableRowActionLink
                          href={`/progress/practice-sessions/${a.id}`}
                          label="View session"
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
          total={attemptsQuery.data?.total ?? 0}
          page={page}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          isFetching={attemptsQuery.isFetching}
        />
      </section>
    </div>
  );
}
