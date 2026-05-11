"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SearchableSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@altitutor/ui";
import { TableHeaderWithTooltip } from "./table-header-with-tooltip";
import { ProgressTablePagination } from "./progress-table-pagination";
import { GraphTypeTabs } from "./graph-type-tabs";
import { format } from "date-fns";
import { ProgressGraph, type GraphDataType } from "./progress-graph";
import { formatTimeSeconds } from "../lib/format-time";
import {
  aggregateForGraph,
  filterByTimeFrame,
  type SharedDateRange,
} from "../lib/progress-data-utils";
import type { MockAttemptRow } from "@/app/api/ucat/progress/route";
import {
  UCAT_CARD_CHROME,
  UCAT_TABLE_BODY_ROW,
  UCAT_TABLE_HEADER_ROW,
  UCAT_TABLE_SHELL,
} from "@/lib/ucat-surface-motion";
import type { ProgressMode, TimeFrameDays } from "../lib/progress-mode";

type MockAttemptsCardProps = {
  attempts: MockAttemptRow[];
  mode: ProgressMode;
  timeFrameDays: TimeFrameDays;
  sharedDateRange?: SharedDateRange;
};

const GRAPH_DATA_TYPES: { value: GraphDataType; label: string }[] = [
  { value: "scaled_score", label: "Scaled score" },
  { value: "percentage", label: "Percentage" },
  { value: "time_taken", label: "Time taken" },
  { value: "exam_speed", label: "Exam speed" },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function getDateRangeLabel(
  mode: ProgressMode,
  timeFrameDays: TimeFrameDays,
): string {
  if (mode === "time_frame") return `Last ${timeFrameDays} days`;
  return mode === "weighted" ? "Weighted average (all time)" : "All time";
}

export function MockAttemptsCard({
  attempts,
  mode,
  timeFrameDays,
  sharedDateRange,
}: MockAttemptsCardProps) {
  const [graphDataType, setGraphDataType] =
    useState<GraphDataType>("scaled_score");
  const [graphType, setGraphType] = useState<"line" | "bar">("line");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredAttempts = useMemo(() => {
    return filterByTimeFrame(attempts, mode, timeFrameDays);
  }, [attempts, mode, timeFrameDays]);

  const mockYAxisMax = useMemo(() => {
    const max = Math.max(
      ...filteredAttempts.map((a) => a.scaledScoreMax ?? a.scaledScore ?? 0),
      900,
    );
    return max;
  }, [filteredAttempts]);

  const { graphData, dateRangeLabel } = useMemo(() => {
    const graphData = aggregateForGraph(
      filteredAttempts,
      (a) => a.completedAt ?? a.attemptedAt,
      (a) => {
        if (graphDataType === "scaled_score") return a.scaledScore ?? 0;
        if (graphDataType === "percentage") {
          const total = a.totalPoints ?? 0;
          return total > 0 ? ((a.scorePoints ?? 0) / total) * 100 : 0;
        }
        if (graphDataType === "time_taken")
          return Math.round(a.timeTakenSeconds ?? 0);
        return (a.studentExamSpeed ?? 0) * 100;
      },
      mode,
      timeFrameDays,
      false,
      sharedDateRange,
    );
    return {
      graphData,
      dateRangeLabel: getDateRangeLabel(mode, timeFrameDays),
    };
  }, [filteredAttempts, graphDataType, mode, timeFrameDays, sharedDateRange]);

  const paginatedAttempts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAttempts.slice(start, start + pageSize);
  }, [filteredAttempts, page, pageSize]);

  return (
    <Card className={UCAT_CARD_CHROME}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Mock attempts</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <SearchableSelect<(typeof GRAPH_DATA_TYPES)[number]>
            items={GRAPH_DATA_TYPES}
            value={
              GRAPH_DATA_TYPES.find((r) => r.value === graphDataType) ?? null
            }
            onValueChange={(item) => item && setGraphDataType(item.value)}
            getItemLabel={(r) => r.label}
            getItemId={(r) => r.value}
            placeholder="Y-axis"
            triggerClassName="w-[140px]"
          />
          <GraphTypeTabs value={graphType} onValueChange={setGraphType} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <ProgressGraph
          data={graphData}
          type={graphType}
          dataType={graphDataType}
          dateRangeLabel={dateRangeLabel}
          isMockContext
          yAxisMax={graphDataType === "scaled_score" ? mockYAxisMax : undefined}
        />
        <div>
          <h4 className="mb-3 text-sm font-medium">All mock attempts</h4>
          <div className={UCAT_TABLE_SHELL}>
            <Table>
              <TableHeader>
                <TableRow className={UCAT_TABLE_HEADER_ROW}>
                  <TableHead>Date</TableHead>
                  <TableHead>Mock</TableHead>
                  <TableHeaderWithTooltip tooltip="Raw score: correct points earned out of total possible points across all sets in this mock.">
                    Points
                  </TableHeaderWithTooltip>
                  <TableHeaderWithTooltip tooltip="Total UCAT mock score. Section 4 Situational Judgement excluded.">
                    Scaled score
                  </TableHeaderWithTooltip>
                  <TableHeaderWithTooltip tooltip="Total time taken vs total time limit for all sets in this mock.">
                    Time
                  </TableHeaderWithTooltip>
                  <TableHeaderWithTooltip tooltip="Average set speed across all sets. >100% means you finished sets faster than their limits.">
                    Set speed
                  </TableHeaderWithTooltip>
                  <TableHeaderWithTooltip tooltip="Average exam speed across all sets. >100% means you finished faster than exam pace.">
                    Exam speed
                  </TableHeaderWithTooltip>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttempts.length === 0 ? (
                  <TableRow className={UCAT_TABLE_BODY_ROW}>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground"
                    >
                      No submitted mock attempts yet
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedAttempts.map((a) => {
                    const dateStr = a.completedAt
                      ? format(new Date(a.completedAt), "dd MMM yyyy")
                      : format(new Date(a.attemptedAt), "dd MMM yyyy");
                    const total = a.totalPoints ?? 0;
                    const points = a.scorePoints ?? 0;
                    const timeLimit = a.setTimeLimitSeconds ?? 0;
                    const timeTaken = a.timeTakenSeconds ?? 0;
                    const setSpeed =
                      a.studentSetSpeed != null
                        ? `${(a.studentSetSpeed * 100).toFixed(1)}%`
                        : "—";
                    const examSpeed =
                      a.studentExamSpeed != null
                        ? `${(a.studentExamSpeed * 100).toFixed(1)}%`
                        : "—";

                    return (
                      <TableRow key={a.id} className={UCAT_TABLE_BODY_ROW}>
                        <TableCell>{dateStr}</TableCell>
                        <TableCell>{a.mockName ?? "—"}</TableCell>
                        <TableCell>
                          {total > 0 ? `${points} / ${total}` : "—"}
                        </TableCell>
                        <TableCell>
                          {a.scaledScore != null && a.scaledScoreMax != null
                            ? `${Math.round(a.scaledScore)} / ${a.scaledScoreMax}`
                            : a.scaledScore != null
                              ? String(Math.round(a.scaledScore))
                              : "—"}
                        </TableCell>
                        <TableCell>
                          {timeLimit > 0 && timeTaken != null
                            ? `${formatTimeSeconds(Math.round(timeTaken))} / ${formatTimeSeconds(Math.round(timeLimit))}`
                            : "—"}
                        </TableCell>
                        <TableCell>{setSpeed}</TableCell>
                        <TableCell>{examSpeed}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/progress/mock-attempts/${a.id}`}>
                              View attempt
                            </Link>
                          </Button>
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
              total={filteredAttempts.length}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
