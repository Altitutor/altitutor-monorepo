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
import type { SetAttemptRow } from "@/app/api/ucat/progress/route";
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

type SetAttemptsCardProps = {
  attempts: SetAttemptRow[];
  /** When set, links go to /progress/sections/{sectionNumber}/set-attempts/{id} so back returns to section. */
  sectionNumber?: number;
};

const GRAPH_DATA_TYPES: { value: GraphDataType; label: string }[] = [
  { value: "scaled_score", label: "Scaled score" },
  { value: "percentage", label: "Percentage" },
  { value: "time_taken", label: "Time taken" },
  { value: "exam_speed", label: "Exam speed" },
  { value: "attempt_count", label: "Number of attempts" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function getSetAttemptMetricValue(
  attempt: SetAttemptRow,
  graphDataType: GraphDataType,
): number {
  if (graphDataType === "scaled_score") return attempt.scaledScore ?? 0;
  if (graphDataType === "percentage") {
    const total = attempt.totalPoints ?? 0;
    return total > 0 ? ((attempt.scorePoints ?? 0) / total) * 100 : 0;
  }
  if (graphDataType === "time_taken")
    return Math.round(attempt.timeTakenSeconds ?? 0);
  if (graphDataType === "attempt_count") return 1;
  return (attempt.studentExamSpeed ?? 0) * 100;
}

export function SetAttemptsCard({
  attempts,
  sectionNumber,
}: SetAttemptsCardProps) {
  const [graphDataType, setGraphDataType] =
    useState<GraphDataType>("scaled_score");
  const [graphType, setGraphType] = useState<"line" | "bar">("line");
  const [xAxisMode, setXAxisMode] = useState<GraphXAxisMode>("date");
  const [dateRange, setDateRange] = useState<GraphDateRange>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { mode, timeFrameDays } = resolveGraphDateRange(dateRange);

  const standaloneAttempts = useMemo(() => {
    const result = attempts.filter((a) => !a.studentUcatMockAttemptId);
    return filterByTimeFrame(result, mode, timeFrameDays);
  }, [attempts, mode, timeFrameDays]);

  const metricOptions = useMemo(() => {
    if (xAxisMode === "attempt") {
      return GRAPH_DATA_TYPES.filter(
        (option) => option.value !== "attempt_count",
      );
    }
    return GRAPH_DATA_TYPES;
  }, [xAxisMode]);

  const handleXAxisModeChange = (nextMode: GraphXAxisMode) => {
    setXAxisMode(nextMode);
    if (nextMode === "attempt" && graphDataType === "attempt_count") {
      setGraphDataType("scaled_score");
    }
  };

  const handleDateRangeChange = (nextRange: GraphDateRange) => {
    setDateRange(nextRange);
    setPage(1);
  };

  const graphData = useMemo(() => {
    const isCountMetric = graphDataType === "attempt_count";
    const getValue = (a: SetAttemptRow) =>
      getSetAttemptMetricValue(a, graphDataType);

    if (xAxisMode === "attempt") {
      return buildAttemptAxisGraphData(
        filterItemsByGraphDateRange(
          standaloneAttempts,
          (a) => a.completedAt ?? a.attemptedAt,
          mode,
          timeFrameDays,
        ),
        (a) => a.completedAt ?? a.attemptedAt,
        getValue,
        (a) => a.id,
        (_a, index) => String(index + 1),
        (a, index) => {
          const name = a.questionSetName?.trim();
          return name
            ? `Attempt #${index + 1} · ${name}`
            : `Attempt #${index + 1}`;
        },
      );
    }

    return aggregateForGraph(
      standaloneAttempts,
      (a) => a.completedAt ?? a.attemptedAt,
      getValue,
      mode,
      timeFrameDays,
      isCountMetric,
    );
  }, [
    standaloneAttempts,
    graphDataType,
    mode,
    timeFrameDays,
    xAxisMode,
  ]);

  const paginatedAttempts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return standaloneAttempts.slice(start, start + pageSize);
  }, [standaloneAttempts, page, pageSize]);

  const setAttemptHref = (attemptId: string) =>
    sectionNumber != null
      ? `/progress/sections/${sectionNumber}/set-attempts/${attemptId}`
      : `/progress/set-attempts/${attemptId}`;

  const attemptsTableTitleId = useId();
  const tableMetric = resolveAttemptTableMetric(graphDataType);
  const metricColumn = getAttemptTableMetricColumn(tableMetric, "set");

  return (
    <>
      <Card className={UCAT_CARD_CHROME}>
        <CardHeader className={UCAT_CARD_HEADER_ROW}>
          <CardTitle>Set attempts</CardTitle>
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
          All set attempts
        </h2>
        <div className={UCAT_TABLE_SHELL}>
          <Table>
            <TableHeader className={UCAT_TABLE_HEADER_CLASSNAME}>
              <TableRow className={UCAT_TABLE_HEADER_ROW}>
                <TableHead>Date</TableHead>
                <TableHead>Set</TableHead>
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
              {standaloneAttempts.length === 0 ? (
                <TableRow className={UCAT_TABLE_BODY_ROW}>
                  <TableCell colSpan={4} className="py-8 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-muted-foreground">
                        No submitted set attempts yet
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
                    : format(new Date(a.attemptedAt), "dd MMM yyyy");

                  return (
                    <TableRow key={a.id} className={UCAT_TABLE_BODY_ROW}>
                      <TableCell>{dateStr}</TableCell>
                      <TableCell className="font-medium">
                        {a.questionSetName ?? "—"}
                      </TableCell>
                      <TableCell>
                        {formatAttemptTableMetricValue(
                          tableMetric,
                          {
                            scaledScore: a.scaledScore,
                            scorePoints: a.scorePoints,
                            totalPoints: a.totalPoints,
                            timeTakenSeconds: a.timeTakenSeconds,
                            setTimeLimitSeconds: a.setTimeLimitSeconds,
                            studentExamSpeed: a.studentExamSpeed,
                          },
                          "set",
                        )}
                      </TableCell>
                      <TableCell>
                        <UcatTableRowActionLink
                          href={setAttemptHref(a.id)}
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
          total={standaloneAttempts.length}
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
