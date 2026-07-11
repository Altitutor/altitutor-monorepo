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
import {
  aggregateForGraph,
  buildAttemptAxisGraphData,
  filterByTimeFrame,
  filterItemsByGraphDateRange,
  type GraphXAxisMode,
} from "../lib/progress-data-utils";
import type { PracticeAttemptRow } from "@/app/api/ucat/progress/route";
import {
  UCAT_CARD_CHROME,
  UCAT_CARD_CONTENT_AFTER_HEADER,
  UCAT_CARD_HEADER_ROW,
  UCAT_TABLE_BODY_ROW,
  UCAT_TABLE_HEADER_CLASSNAME,
  UCAT_TABLE_HEADER_ROW,
  UCAT_TABLE_SHELL,
} from "@/lib/ucat-surface-motion";
import {
  resolveGraphDateRange,
  type GraphDateRange,
} from "../lib/progress-mode";
import { ProgressClearFilterButton } from "./progress-clear-filter-button";

type PracticeAttemptsCardProps = {
  attempts: PracticeAttemptRow[];
};

const PRACTICE_GRAPH_DATA_TYPES: { value: GraphDataType; label: string }[] = [
  { value: "attempt_count", label: "Number of attempts" },
  { value: "percentage", label: "Percentage" },
  { value: "time_taken", label: "Time taken" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function getPracticeAttemptMetricValue(
  attempt: PracticeAttemptRow,
  graphDataType: GraphDataType,
): number {
  if (graphDataType === "attempt_count") return 1;
  if (graphDataType === "percentage") {
    const total = attempt.totalPoints ?? 0;
    return total > 0 ? ((attempt.scorePoints ?? 0) / total) * 100 : 0;
  }
  if (graphDataType === "time_taken")
    return Math.round(attempt.timeTakenSeconds ?? 0);
  return 0;
}

function metricOptionsForXAxis(xAxisMode: GraphXAxisMode) {
  if (xAxisMode === "attempt") {
    return PRACTICE_GRAPH_DATA_TYPES.filter(
      (option) => option.value !== "attempt_count",
    );
  }
  return PRACTICE_GRAPH_DATA_TYPES;
}

export function PracticeAttemptsCard({
  attempts,
}: PracticeAttemptsCardProps) {
  const [graphDataType, setGraphDataType] =
    useState<GraphDataType>("percentage");
  const [graphType, setGraphType] = useState<"line" | "bar">("line");
  const [xAxisMode, setXAxisMode] = useState<GraphXAxisMode>("date");
  const [dateRange, setDateRange] = useState<GraphDateRange>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { mode, timeFrameDays } = resolveGraphDateRange(dateRange);

  const filteredAttempts = useMemo(
    () => filterByTimeFrame(attempts, mode, timeFrameDays),
    [attempts, mode, timeFrameDays],
  );

  const metricOptions = useMemo(
    () => metricOptionsForXAxis(xAxisMode),
    [xAxisMode],
  );

  const handleXAxisModeChange = (nextMode: GraphXAxisMode) => {
    setXAxisMode(nextMode);
    if (nextMode === "attempt" && graphDataType === "attempt_count") {
      setGraphDataType("percentage");
    }
  };

  const handleDateRangeChange = (nextRange: GraphDateRange) => {
    setDateRange(nextRange);
    setPage(1);
  };

  const graphData = useMemo(() => {
    const isCountMetric = graphDataType === "attempt_count";
    const getValue = (a: PracticeAttemptRow) =>
      getPracticeAttemptMetricValue(a, graphDataType);

    if (xAxisMode === "attempt") {
      return buildAttemptAxisGraphData(
        filterItemsByGraphDateRange(
          filteredAttempts,
          (a) => a.completedAt ?? a.attemptedAt,
          mode,
          timeFrameDays,
        ),
        (a) => a.completedAt ?? a.attemptedAt,
        getValue,
        (a) => a.id,
        (_a, index) => String(index + 1),
        (a, index) => {
          const name = a.sectionName?.trim();
          return name
            ? `Attempt #${index + 1} · ${name}`
            : `Attempt #${index + 1}`;
        },
      );
    }

    return aggregateForGraph(
      filteredAttempts,
      (a) => a.completedAt ?? a.attemptedAt,
      getValue,
      mode,
      timeFrameDays,
      isCountMetric,
    );
  }, [
    filteredAttempts,
    graphDataType,
    mode,
    timeFrameDays,
    xAxisMode,
  ]);

  const paginatedAttempts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAttempts.slice(start, start + pageSize);
  }, [filteredAttempts, page, pageSize]);

  const attemptsTableTitleId = useId();
  const tableMetric = resolveAttemptTableMetric(graphDataType, "practice");
  const metricColumn = getAttemptTableMetricColumn(tableMetric, "practice");

  return (
    <>
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
            xAxisMode={xAxisMode}
            onXAxisModeChange={handleXAxisModeChange}
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
                paginatedAttempts.map((a) => {
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
          total={filteredAttempts.length}
          page={page}
          pageSize={pageSize}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </section>
    </>
  );
}
