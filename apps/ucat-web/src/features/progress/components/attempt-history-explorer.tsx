"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  SmartDatePickerField,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@altitutor/ui";
import { ArrowRight, CalendarDays, X } from "lucide-react";
import type {
  ProgressAttemptRow,
  ProgressAttemptSource,
} from "@/app/api/ucat/progress/attempts/route";
import type { DailyProgressSeriesPoint } from "@/app/api/ucat/progress/series/route";
import { Button } from "@/components/ui/button";
import { ProgressGraph, type GraphDataType } from "./progress-graph";
import { AttemptMetricColumnHeader } from "./attempt-metric-column-header";
import { ProgressTablePagination } from "./progress-table-pagination";
import { UcatTableRowActionLink } from "./ucat-table-row-action-link";
import {
  UnreviewedAttemptDot,
  UnreviewedAttemptTooltip,
} from "./unreviewed-attempt-indicator";
import { useProgressAttempts } from "../hooks/use-progress-attempts";
import { useProgressSeries } from "../hooks/use-progress-series";
import { buildDailyProgressGraphData } from "../lib/daily-progress-series";
import type { GraphDateRange } from "../lib/progress-mode";
import { formatSpeedPercentAsMultiplier } from "../lib/format-speed-multiplier";
import {
  formatAttemptTableMetricValue,
  getAttemptTableMetricColumn,
  resolveAttemptTableMetric,
  type AttemptTableMetric,
} from "../lib/attempt-table-metric";
import {
  UCAT_CONTROL_PRESS,
  UCAT_FOCUS_RING_INSET,
  UCAT_FLOATING_GRAPH_CARD,
  UCAT_NEUTRAL_ACTION_HOVER,
  UCAT_PRESSABLE_SURFACE_HOVER,
  UCAT_TABLE_BODY_ROW,
  UCAT_TABLE_HEADER_CLASSNAME,
  UCAT_TABLE_HEADER_ROW,
  UCAT_TABLE_SHELL,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type AttemptHistoryExplorerProps = {
  source: ProgressAttemptSource;
  title: string;
  description?: string;
  sectionNumber?: number;
  defaultMetric: GraphDataType;
  metricOptions: { value: GraphDataType; label: string }[];
  isMockContext?: boolean;
  yAxisMax?: number;
  previewData?: AttemptHistoryPreviewData;
  emptyActionHref?: string;
  emptyActionLabel?: string;
};

export type AttemptHistoryPreviewData = {
  series: DailyProgressSeriesPoint[];
  attempts: ProgressAttemptRow[];
};

function attemptDate(attempt: ProgressAttemptRow): string | null {
  return attempt.completedAt ?? attempt.attemptedAt ?? null;
}

function attemptName(attempt: ProgressAttemptRow): string {
  if (attempt.source === "practice") return `${attempt.sectionName} practice`;
  if (attempt.source === "set") return attempt.questionSetName ?? "UCAT set";
  return attempt.mockName ?? "UCAT mock";
}

function attemptHref(attempt: ProgressAttemptRow, sectionNumber?: number) {
  if (attempt.source === "practice") {
    return `/progress/practice-sessions/${attempt.id}`;
  }
  if (attempt.source === "set") {
    return sectionNumber == null
      ? `/progress/set-attempts/${attempt.id}`
      : `/progress/sections/${sectionNumber}/set-attempts/${attempt.id}`;
  }
  return `/progress/mocks/mock-attempts/${attempt.id}`;
}

function attemptMetricValue(
  attempt: ProgressAttemptRow,
  metric: AttemptTableMetric,
): string {
  if (attempt.source === "practice") {
    return formatAttemptTableMetricValue(
      metric,
      {
        scorePoints: attempt.scorePoints,
        totalPoints: attempt.totalPoints,
        timeTakenSeconds: attempt.timeTakenSeconds,
        questionCount: attempt.questionCount,
      },
      "practice",
    );
  }
  return formatAttemptTableMetricValue(
    metric,
    {
      scaledScore: attempt.scaledScore,
      scaledScoreMax:
        attempt.source === "mock" ? attempt.scaledScoreMax : undefined,
      scorePoints: attempt.scorePoints,
      totalPoints: attempt.totalPoints,
      rawScoreBreakdown:
        attempt.source === "mock" ? attempt.rawScoreBreakdown : undefined,
      timeTakenSeconds: attempt.timeTakenSeconds,
      setTimeLimitSeconds: attempt.setTimeLimitSeconds,
      studentExamSpeed: attempt.studentExamSpeed,
    },
    attempt.source,
  );
}

const SET_TABLE_METRICS: { value: AttemptTableMetric; label: string }[] = [
  { value: "raw_score", label: "Raw score" },
  { value: "scaled_score", label: "Scaled score" },
  { value: "time_taken", label: "Time taken" },
  { value: "exam_speed", label: "Exam speed" },
];

const ATTEMPTS_DIALOG_PAGE_SIZE = 8;
const RECENT_ATTEMPTS_LIMIT = 5;

function filterPreviewAttempts(
  attempts: ProgressAttemptRow[],
  dateRange: GraphDateRange,
  selectedRange?: { start: string; end: string } | null,
): ProgressAttemptRow[] {
  const cutoff = new Date();
  if (dateRange !== "all") {
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - Number(dateRange) + 1);
  }

  return attempts
    .filter((attempt) => {
      const date = attemptDate(attempt);
      if (!date) return false;
      const dateKey = date.slice(0, 10);
      if (selectedRange) {
        return dateKey >= selectedRange.start && dateKey <= selectedRange.end;
      }
      return dateRange === "all" || new Date(date) >= cutoff;
    })
    .sort((left, right) =>
      (attemptDate(right) ?? "").localeCompare(attemptDate(left) ?? ""),
    );
}

export function AttemptHistoryExplorer({
  source,
  title,
  description,
  sectionNumber,
  defaultMetric,
  metricOptions,
  isMockContext = false,
  yAxisMax,
  previewData,
  emptyActionHref,
  emptyActionLabel,
}: AttemptHistoryExplorerProps) {
  const [metric, setMetric] = useState<GraphDataType>(defaultMetric);
  const [tableMetric, setTableMetric] = useState<AttemptTableMetric>(() =>
    source === "practice" ? "raw_score" : "scaled_score",
  );
  const [dateRange, setDateRange] = useState<GraphDateRange>("all");
  const [selectedRange, setSelectedRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const seriesQuery = useProgressSeries(
    source,
    sectionNumber,
    previewData == null,
  );
  const recentQuery = useProgressAttempts({
    source,
    sectionNumber,
    page: 1,
    pageSize: RECENT_ATTEMPTS_LIMIT,
    dateRange,
    date: selectedRange?.start,
    dateTo: selectedRange?.end,
    enabled: previewData == null,
  });
  const allQuery = useProgressAttempts({
    source,
    sectionNumber,
    page,
    pageSize: ATTEMPTS_DIALOG_PAGE_SIZE,
    dateRange,
    date: dialogDate ?? undefined,
    enabled: previewData == null && dialogOpen,
  });
  const previewRecentAttempts = useMemo(
    () =>
      previewData
        ? filterPreviewAttempts(previewData.attempts, dateRange, selectedRange)
        : [],
    [dateRange, previewData, selectedRange],
  );
  const previewAllAttempts = useMemo(
    () =>
      previewData
        ? filterPreviewAttempts(
            previewData.attempts,
            dateRange,
            dialogDate ? { start: dialogDate, end: dialogDate } : null,
          )
        : [],
    [dateRange, dialogDate, previewData],
  );
  const graphData = useMemo(
    () =>
      buildDailyProgressGraphData(
        previewData?.series ?? seriesQuery.data?.points ?? [],
        metric,
        dateRange,
      ),
    [dateRange, metric, previewData?.series, seriesQuery.data?.points],
  );
  const rawSeries = previewData?.series ?? seriesQuery.data?.points ?? [];
  const hasAnyAttempts = rawSeries.some((point) => point.attemptCount > 0);
  const recentAttempts = previewData
    ? previewRecentAttempts.slice(0, RECENT_ATTEMPTS_LIMIT)
    : (recentQuery.data?.attempts ?? []);
  const allAttempts = previewData
    ? previewAllAttempts.slice(
        (page - 1) * ATTEMPTS_DIALOG_PAGE_SIZE,
        page * ATTEMPTS_DIALOG_PAGE_SIZE,
      )
    : (allQuery.data?.attempts ?? []);
  const recentTableMetric = resolveAttemptTableMetric(
    metric,
    source === "practice" ? "practice" : "set",
  );
  const tableMetricColumn = getAttemptTableMetricColumn(tableMetric, source);
  const handlePointSelect = (point: { date: string; label?: string }) => {
    const end = point.label
      ? format(addDays(new Date(`${point.date}T12:00:00`), 6), "yyyy-MM-dd")
      : point.date;
    setSelectedRange((current) =>
      current?.start === point.date ? null : { start: point.date, end },
    );
  };

  return (
    <section
      aria-labelledby={`${source}-attempt-history-title`}
      className="relative isolate overflow-hidden border-b border-border/50 bg-gradient-to-b from-background via-muted/15 to-background px-5 py-6 sm:px-8 lg:px-10"
    >
      <div className="mb-3">
        <h2
          id={`${source}-attempt-history-title`}
          className="text-xl font-semibold tracking-tight"
        >
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>

      <div className="relative min-h-[420px]">
        <ProgressGraph
          data={graphData}
          type="bar"
          dataType={metric}
          dateRange={dateRange}
          onDateRangeChange={(range) => {
            setDateRange(range);
            setSelectedRange(null);
          }}
          metricOptions={metricOptions}
          onDataTypeChange={setMetric}
          isMockContext={isMockContext}
          yAxisMax={yAxisMax}
          selectedDate={selectedRange?.start ?? null}
          onPointSelect={handlePointSelect}
          trailingSpace
          className="pt-1"
          emptyMessage={`${title} will appear here`}
          emptyDescription="Complete an attempt to start building this graph."
        />
        <div className="sr-only" aria-label={`Selectable ${title} periods`}>
          {graphData
            .filter((point) => point.value != null)
            .map((point) => (
              <button
                key={point.date}
                type="button"
                onClick={() => handlePointSelect(point)}
              >
                {point.tooltipLabel ?? point.label ?? point.date}:{" "}
                {metric === "exam_speed" || metric === "question_speed"
                  ? formatSpeedPercentAsMultiplier(point.value)
                  : point.value}
              </button>
            ))}
        </div>

        <aside
          className={cn(
            UCAT_FLOATING_GRAPH_CARD,
            "mt-4 flex flex-col p-5 lg:absolute lg:right-0 lg:top-2 lg:mt-0 lg:w-[430px]",
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                {selectedRange
                  ? selectedRange.start === selectedRange.end
                    ? format(
                        new Date(`${selectedRange.start}T12:00:00`),
                        "d MMM yyyy",
                      )
                    : `${format(new Date(`${selectedRange.start}T12:00:00`), "d MMM")}–${format(new Date(`${selectedRange.end}T12:00:00`), "d MMM")}`
                  : "Recent attempts"}
              </p>
            </div>
            {selectedRange ? (
              <button
                type="button"
                onClick={() => setSelectedRange(null)}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear selected period"
              >
                <X className="size-4" aria-hidden />
              </button>
            ) : null}
          </div>

          <div className="mt-4 divide-y divide-border/60">
            {recentAttempts.length > 0 ? (
              recentAttempts.map((attempt) => {
                const date = attemptDate(attempt);
                const attemptLink = (
                  <Link
                    key={`${attempt.source}-${attempt.id}`}
                    href={attemptHref(attempt, sectionNumber)}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-2 py-2.5",
                      UCAT_CONTROL_PRESS,
                      UCAT_PRESSABLE_SURFACE_HOVER,
                      UCAT_FOCUS_RING_INSET,
                    )}
                    aria-label={
                      attempt.reviewCompletedAt == null
                        ? `${attemptName(attempt)}. This attempt is unreviewed.`
                        : undefined
                    }
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <CalendarDays className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {attemptName(attempt)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {attemptMetricValue(attempt, recentTableMetric)}
                        {date ? ` · ${format(new Date(date), "d MMM")}` : ""}
                      </span>
                    </span>
                    <ArrowRight
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                    {attempt.reviewCompletedAt == null ? (
                      <UnreviewedAttemptDot />
                    ) : null}
                  </Link>
                );
                return attempt.reviewCompletedAt == null ? (
                  <UnreviewedAttemptTooltip
                    key={`${attempt.source}-${attempt.id}`}
                  >
                    {attemptLink}
                  </UnreviewedAttemptTooltip>
                ) : (
                  attemptLink
                );
              })
            ) : (
              <p className="py-5 text-sm text-muted-foreground">
                {selectedRange
                  ? "No completed attempts in this period."
                  : "No completed attempts yet."}
              </p>
            )}
          </div>

          {!hasAnyAttempts && emptyActionHref && emptyActionLabel ? (
            <Button asChild className="mt-4 w-full shrink-0">
              <Link href={emptyActionHref}>{emptyActionLabel}</Link>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              className={cn(UCAT_NEUTRAL_ACTION_HOVER, "mt-4 w-full shrink-0")}
              onClick={() => setDialogOpen(true)}
            >
              View all attempts
            </Button>
          )}
        </aside>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="!flex !h-[min(90dvh,760px)] w-[min(96vw,1200px)] max-w-none flex-col overflow-y-auto sm:!h-[min(90dvh,760px)] sm:max-w-6xl"
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>All {title.toLowerCase()}</DialogTitle>
          </DialogHeader>
          <div className="w-full max-w-xs shrink-0">
            <SmartDatePickerField
              value={dialogDate}
              onChange={(value) => {
                setDialogDate(value);
                setPage(1);
              }}
              placeholder="Filter by date"
              modal
              stopPropagation
              maxDate={format(new Date(), "yyyy-MM-dd")}
            />
          </div>
          <div className={cn(UCAT_TABLE_SHELL, "shrink-0")}>
            <Table>
              <TableHeader
                className={cn(UCAT_TABLE_HEADER_CLASSNAME, "bg-card")}
              >
                <TableRow className={UCAT_TABLE_HEADER_ROW}>
                  <TableHead>Date</TableHead>
                  <TableHead>Attempt</TableHead>
                  {source === "set" ? (
                    <AttemptMetricColumnHeader
                      options={SET_TABLE_METRICS}
                      value={tableMetric}
                      onValueChange={setTableMetric}
                      label={tableMetricColumn.label}
                      tooltip={tableMetricColumn.tooltip}
                    />
                  ) : (
                    <TableHead>Raw score</TableHead>
                  )}
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allAttempts.map((attempt) => {
                  const date = attemptDate(attempt);
                  return (
                    <TableRow
                      key={`${attempt.source}-${attempt.id}`}
                      className={UCAT_TABLE_BODY_ROW}
                    >
                      <TableCell>
                        {date ? format(new Date(date), "dd MMM yyyy") : "—"}
                      </TableCell>
                      <TableCell className="font-medium">
                        {attemptName(attempt)}
                      </TableCell>
                      <TableCell>
                        {attemptMetricValue(attempt, tableMetric)}
                      </TableCell>
                      <TableCell>
                        <UcatTableRowActionLink
                          href={attemptHref(attempt, sectionNumber)}
                          label="View attempt"
                          unreviewed={attempt.reviewCompletedAt == null}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {allAttempts.length === 0 ? (
                  <TableRow className={UCAT_TABLE_BODY_ROW}>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-muted-foreground"
                    >
                      No attempts in this date range.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
          <div className="mt-auto shrink-0">
            <ProgressTablePagination
              total={
                previewData
                  ? previewAllAttempts.length
                  : (allQuery.data?.total ?? 0)
              }
              page={page}
              pageSize={ATTEMPTS_DIALOG_PAGE_SIZE}
              onPageChange={setPage}
              showPageSizeSelector={false}
              isFetching={allQuery.isFetching}
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
