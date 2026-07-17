"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { SearchableSelect } from "@altitutor/ui";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { formatTimeSeconds } from "../lib/format-time";
import { formatSpeedPercentAsMultiplier } from "../lib/format-speed-multiplier";
import type { GraphXAxisMode } from "../lib/progress-data-utils";
import {
  GRAPH_DATE_RANGE_OPTIONS,
  type GraphDateRange,
} from "../lib/progress-mode";
import { ProgressOutlineSelectTrigger } from "./progress-outline-select-trigger";

function formatXAxisDate(dateStr: string): string {
  try {
    return format(new Date(dateStr + "T12:00:00"), "MMM d");
  } catch {
    return dateStr;
  }
}

function getXAxisTickLabel(
  data: { date: string; label?: string }[],
  date: string,
): string {
  const point = data.find((candidate) => candidate.date === date);
  if (point?.label) return point.label;
  return formatXAxisDate(point?.date ?? date);
}

export type GraphDataType =
  | "scaled_score"
  | "percentage"
  | "time_taken"
  | "exam_speed"
  | "question_speed"
  | "attempt_count";

export type ProgressGraphMetricOption = {
  value: GraphDataType;
  label: string;
};

export type ProgressGraphXAxisOption = {
  value: GraphXAxisMode;
  label: string;
};

export type ProgressGraphDateRangeOption = {
  value: GraphDateRange;
  label: string;
};

export const GRAPH_X_AXIS_OPTIONS: ProgressGraphXAxisOption[] = [
  { value: "date", label: "Date" },
  { value: "attempt", label: "Attempt" },
];

export type ProgressGraphProps = {
  data: {
    date: string;
    value: number | null;
    label?: string;
    tooltipLabel?: string;
    isSpacer?: boolean;
  }[];
  type: "line" | "bar";
  dataType: GraphDataType;
  dateRangeLabel?: string;
  className?: string;
  /** Shorter chart for embedding beside summary stats. */
  compact?: boolean;
  /** When true, scaled_score uses dynamic max from data. Pass yAxisMax for mock context. */
  isMockContext?: boolean;
  /** Max value for Y-axis when isMockContext (e.g. max scaled score across attempts). */
  yAxisMax?: number;
  yAxisDomain?: [number, number];
  yAxisLabel?: string;
  /** When set with onDataTypeChange, the Y-axis label opens a metric picker. */
  metricOptions?: ProgressGraphMetricOption[];
  onDataTypeChange?: (value: GraphDataType) => void;
  xAxisMode?: GraphXAxisMode;
  xAxisOptions?: ProgressGraphXAxisOption[];
  onXAxisModeChange?: (value: GraphXAxisMode) => void;
  /** Selectable date-range filter (replaces static dateRangeLabel when provided). */
  dateRange?: GraphDateRange;
  dateRangeOptions?: ProgressGraphDateRangeOption[];
  onDateRangeChange?: (value: GraphDateRange) => void;
  projection?: {
    pessimistic: { date: string; value: number }[];
    realistic: { date: string; value: number }[];
    optimistic: { date: string; value: number }[];
  };
  selectedDate?: string | null;
  onPointSelect?: (point: {
    date: string;
    value: number | null;
    label?: string;
    tooltipLabel?: string;
  }) => void;
  /** Adds blank plot columns so the latest real point sits before an overlay card. */
  trailingSpace?: boolean;
};

const dataTypeLabels: Record<GraphDataType, string> = {
  scaled_score: "Scaled score",
  percentage: "Percentage (%)",
  time_taken: "Time taken",
  exam_speed: "Exam speed",
  question_speed: "Question speed",
  attempt_count: "Number of attempts",
};

function getYAxisDomain(
  dataType: GraphDataType,
  isMockContext?: boolean,
  yAxisMax?: number,
): [number, number] | undefined {
  if (dataType === "scaled_score")
    return isMockContext && yAxisMax != null ? [0, yAxisMax] : [300, 900];
  if (dataType === "percentage") return [0, 100];
  return undefined;
}

function AxisLabelSelect<T extends { value: string; label: string }>({
  items,
  value,
  onValueChange,
  ariaLabel,
  align = "start",
}: {
  items: T[];
  value: T | null;
  onValueChange: (value: T["value"]) => void;
  ariaLabel: string;
  align?: "start" | "center" | "end";
}) {
  const label = value?.label ?? "Select";
  return (
    <SearchableSelect<T>
      items={items}
      value={value}
      onValueChange={(item) => {
        if (item) onValueChange(item.value);
      }}
      getItemLabel={(item) => item.label}
      getItemId={(item) => item.value}
      searchPlaceholder="Search..."
      emptyMessage="No options found."
      align={align}
      contentWidth="180px"
      showChevron={false}
      trigger={
        <ProgressOutlineSelectTrigger label={label} ariaLabel={ariaLabel} />
      }
    />
  );
}

const PROJECTION_SERIES_LABELS: Record<string, string> = {
  value: "Estimate",
  projectionRealistic: "Projected",
  projectionPessimistic: "Low",
  projectionOptimistic: "High",
};

function GraphColumnCursor({
  x,
  y,
  width,
  height,
}: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}) {
  if (x == null || y == null || width == null || height == null) return null;

  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={4}
      fill="var(--graph-column-highlight)"
      focusable="false"
      pointerEvents="none"
      aria-hidden="true"
      style={{ outline: "none" }}
    />
  );
}

export function ProgressGraph({
  data,
  type,
  dataType,
  dateRangeLabel,
  className,
  compact = false,
  isMockContext = false,
  yAxisMax,
  yAxisDomain,
  yAxisLabel,
  metricOptions,
  onDataTypeChange,
  xAxisMode = "date",
  xAxisOptions,
  onXAxisModeChange,
  dateRange,
  dateRangeOptions,
  onDateRangeChange,
  projection,
  selectedDate = null,
  onPointSelect,
  trailingSpace = false,
}: ProgressGraphProps) {
  const hasOverlayCard = useMediaQuery("(min-width: 1024px)");
  type GraphLinePoint = {
    date: string;
    value: number | null;
    label?: string;
    tooltipLabel?: string;
    projectionPessimistic?: number;
    projectionRealistic?: number;
    projectionOptimistic?: number;
    /** Fill-only copy of optimistic; keeps Area out of the line tooltip. */
    projectionBandHigh?: number;
  };

  const trailingSpacerCount =
    trailingSpace && hasOverlayCard && data.length > 0
      ? Math.max(2, Math.ceil(data.length * 0.9))
      : 0;
  const displayData =
    trailingSpacerCount === 0
      ? data
      : [
          ...data,
          ...Array.from({ length: trailingSpacerCount }, (_, index) => ({
            date: `__trailing-space-${index}`,
            value: null,
            label: "",
            tooltipLabel: "",
            isSpacer: true,
          })),
        ];
  const hasCustomTickLabels = data.some((d) => d.label);
  const selectedMetricOption =
    metricOptions?.find((option) => option.value === dataType) ?? null;
  const label =
    yAxisLabel ?? selectedMetricOption?.label ?? dataTypeLabels[dataType];
  const canSelectMetric =
    metricOptions != null &&
    metricOptions.length > 0 &&
    onDataTypeChange != null;
  const resolvedXAxisOptions = xAxisOptions ?? GRAPH_X_AXIS_OPTIONS;
  const selectedXAxisOption =
    resolvedXAxisOptions.find((option) => option.value === xAxisMode) ?? null;
  const canSelectXAxis =
    onXAxisModeChange != null && resolvedXAxisOptions.length > 0;
  const resolvedDateRangeOptions = dateRangeOptions ?? GRAPH_DATE_RANGE_OPTIONS;
  const selectedDateRangeOption =
    dateRange != null
      ? (resolvedDateRangeOptions.find(
          (option) => option.value === dateRange,
        ) ?? null)
      : null;
  const canSelectDateRange =
    dateRange != null &&
    onDateRangeChange != null &&
    resolvedDateRangeOptions.length > 0;
  const domain =
    yAxisDomain ?? getYAxisDomain(dataType, isMockContext, yAxisMax);
  const showProjection =
    type === "line" &&
    dataType === "scaled_score" &&
    xAxisMode === "date" &&
    !hasCustomTickLabels &&
    projection != null;

  const mergedLineData: GraphLinePoint[] = showProjection
    ? (() => {
        const byDate = new Map<string, GraphLinePoint>();
        for (const point of data) {
          byDate.set(point.date, { ...point, value: point.value });
        }
        for (const point of projection.pessimistic) {
          const current = byDate.get(point.date) ?? {
            date: point.date,
            value: null,
          };
          current.projectionPessimistic = point.value;
          byDate.set(point.date, current);
        }
        for (const point of projection.realistic) {
          const current = byDate.get(point.date) ?? {
            date: point.date,
            value: null,
          };
          current.projectionRealistic = point.value;
          byDate.set(point.date, current);
        }
        for (const point of projection.optimistic) {
          const current = byDate.get(point.date) ?? {
            date: point.date,
            value: null,
          };
          current.projectionOptimistic = point.value;
          current.projectionBandHigh = point.value;
          byDate.set(point.date, current);
        }
        return [...byDate.values()].sort((a, b) =>
          a.date.localeCompare(b.date),
        );
      })()
    : data.map((point) => ({ ...point }));

  const projectionBaseLine =
    showProjection && mergedLineData.length > 0
      ? mergedLineData.map((point, index) => ({
          x: index,
          y: point.projectionPessimistic ?? point.projectionOptimistic ?? 0,
        }))
      : undefined;

  const formatTooltipValue = (value: number | null | undefined): string => {
    if (value == null) return "—";
    if (dataType === "time_taken") return formatTimeSeconds(value); // value is in seconds
    if (dataType === "exam_speed" || dataType === "question_speed") {
      return formatSpeedPercentAsMultiplier(value);
    }
    if (dataType === "percentage") {
      return String(Math.round(value));
    }
    if (dataType === "scaled_score") return String(Math.round(value));
    return String(value);
  };

  const formatTooltipLabel = (
    rawLabel: string,
    payload:
      | {
          date: string;
          label?: string;
          tooltipLabel?: string;
        }
      | undefined,
  ): string => {
    if (payload?.tooltipLabel) return payload.tooltipLabel;
    const displayLabel = payload?.label ?? formatXAxisDate(rawLabel);
    if (xAxisMode === "attempt") return `Attempt: ${displayLabel}`;
    if (payload?.label) return `Period: ${displayLabel}`;
    return `Date: ${displayLabel}`;
  };

  const pointCount = showProjection
    ? mergedLineData.length
    : displayData.length;
  // Keep labels horizontal and sparse — never tilt ticks.
  const maxXTicks = compact ? 5 : 6;
  const xTickInterval =
    pointCount > maxXTicks
      ? Math.max(0, Math.ceil(pointCount / maxXTicks) - 1)
      : 0;
  // Room for tick labels; the X-axis mode label sits outside the chart.
  const chartBottomMargin = compact ? 12 : 20;
  const chartTopMargin = compact ? 8 : 16;
  const tickFontSize = compact || pointCount > maxXTicks ? 10 : 12;

  const tooltipContent = ({
    active,
    label: rawLabel,
    payload,
  }: {
    active?: boolean;
    label?: string | number;
    payload?: ReadonlyArray<{
      dataKey?: string | number;
      name?: string;
      value?: number | string | null;
      color?: string;
      payload?: {
        date: string;
        label?: string;
        tooltipLabel?: string;
        value?: number | null;
        isSpacer?: boolean;
      };
    }>;
  }) => {
    if (!active || payload == null || payload.length === 0) return null;

    const point = payload[0]?.payload;
    if (point?.isSpacer) return null;
    const hasEstimate = point?.value != null;
    const seenKeys = new Set<string>();
    const rows = payload.filter((entry) => {
      const key = String(entry.dataKey ?? entry.name ?? "");
      if (key === "projectionBandHigh") return false;
      if (
        hasEstimate &&
        (key === "projectionRealistic" ||
          key === "projectionPessimistic" ||
          key === "projectionOptimistic")
      ) {
        return false;
      }
      if (entry.value == null || entry.value === "") return false;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    if (rows.length === 0) return null;

    const dateLabel =
      typeof rawLabel === "string" || typeof rawLabel === "number"
        ? String(rawLabel)
        : "";

    return (
      <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-sm">
        <p className="mb-1 font-medium text-foreground">
          {formatTooltipLabel(dateLabel, point)}
        </p>
        <ul className="space-y-0.5">
          {rows.map((entry) => {
            const key = String(entry.dataKey ?? entry.name ?? "value");
            const rowLabel = PROJECTION_SERIES_LABELS[key] ?? label;
            const numericValue =
              typeof entry.value === "number"
                ? entry.value
                : Number(entry.value);
            return (
              <li
                key={key}
                className="flex items-center gap-2 text-muted-foreground"
              >
                <span
                  className="inline-block size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span>
                  {rowLabel}:{" "}
                  <span className="font-medium text-foreground">
                    {formatTooltipValue(
                      Number.isFinite(numericValue) ? numericValue : null,
                    )}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  const chartContent =
    type === "line" ? (
      <LineChart
        data={mergedLineData}
        margin={{
          top: chartTopMargin,
          right: compact ? 4 : 5,
          left: compact ? 0 : 5,
          bottom: chartBottomMargin,
        }}
      >
        {compact ? null : (
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        )}
        <XAxis
          dataKey="date"
          tick={{
            fontSize: tickFontSize,
            textAnchor: "middle",
          }}
          tickFormatter={(value) =>
            getXAxisTickLabel(mergedLineData, String(value))
          }
          interval={xTickInterval}
          stroke="currentColor"
          className="text-muted-foreground"
          minTickGap={compact ? 48 : 40}
        />
        <YAxis
          domain={domain}
          tick={{ fontSize: tickFontSize }}
          stroke="currentColor"
          className="text-muted-foreground"
          width={compact ? 36 : undefined}
          tickFormatter={
            dataType === "time_taken"
              ? (value) => formatTimeSeconds(value)
              : dataType === "exam_speed" || dataType === "question_speed"
                ? (value) => formatSpeedPercentAsMultiplier(value)
                : undefined
          }
        />
        <Tooltip content={tooltipContent} />
        {showProjection ? (
          <>
            <Area
              type="monotone"
              dataKey="projectionBandHigh"
              baseLine={projectionBaseLine}
              stroke="none"
              fill="hsl(var(--accent))"
              fillOpacity={0.12}
              connectNulls
              tooltipType="none"
              legendType="none"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="projectionOptimistic"
              name="projectionOptimistic"
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="2 4"
              strokeWidth={1.25}
              strokeOpacity={0.7}
              dot={false}
              activeDot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="projectionPessimistic"
              name="projectionPessimistic"
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="2 4"
              strokeWidth={1.25}
              strokeOpacity={0.7}
              dot={false}
              activeDot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="projectionRealistic"
              name="projectionRealistic"
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="6 4"
              strokeWidth={1.5}
              dot={false}
              activeDot={false}
              connectNulls
            />
          </>
        ) : null}
        <Line
          type="monotone"
          dataKey="value"
          name="value"
          stroke="hsl(var(--accent))"
          strokeWidth={2}
          dot={{ fill: "hsl(var(--accent))", r: compact ? 3 : 4 }}
          activeDot={{ r: compact ? 5 : 6 }}
          connectNulls={true}
          isAnimationActive={false}
        />
      </LineChart>
    ) : (
      <BarChart
        data={displayData}
        className={onPointSelect ? "cursor-pointer" : undefined}
        onClick={(state) => {
          if (!onPointSelect) return;
          const chartState = state as unknown as {
            activeLabel?: string | number;
            activeTooltipIndex?: string | number;
            activePayload?: Array<{
              payload?: {
                date?: string;
                value?: number | null;
                label?: string;
                tooltipLabel?: string;
                isSpacer?: boolean;
              };
            }>;
          };
          const payloadPoint = (
            chartState as {
              activePayload?: Array<{
                payload?: {
                  date?: string;
                  value?: number | null;
                  label?: string;
                  tooltipLabel?: string;
                  isSpacer?: boolean;
                };
              }>;
            }
          ).activePayload?.[0]?.payload;
          const activePoint =
            payloadPoint ??
            displayData.find(
              (point, index) =>
                point.date === String(chartState.activeLabel ?? "") ||
                index === Number(chartState.activeTooltipIndex),
            );
          if (!activePoint?.date || activePoint.isSpacer) return;
          onPointSelect({
            date: activePoint.date,
            value: activePoint.value ?? null,
            label: activePoint.label,
            tooltipLabel: activePoint.tooltipLabel,
          });
        }}
        margin={{
          top: chartTopMargin,
          right: 5,
          left: 5,
          bottom: chartBottomMargin,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tick={{
            fontSize: tickFontSize,
            textAnchor: "middle",
          }}
          tickFormatter={(value) =>
            String(value).startsWith("__trailing-space-")
              ? ""
              : getXAxisTickLabel(displayData, String(value))
          }
          interval={xTickInterval}
          stroke="currentColor"
          className="text-muted-foreground"
          minTickGap={40}
        />
        <YAxis
          domain={domain}
          tick={{ fontSize: tickFontSize }}
          stroke="currentColor"
          className="text-muted-foreground"
          tickFormatter={
            dataType === "time_taken"
              ? (value) => formatTimeSeconds(value)
              : dataType === "exam_speed" || dataType === "question_speed"
                ? (value) => formatSpeedPercentAsMultiplier(value)
                : undefined
          }
        />
        <Tooltip content={tooltipContent} cursor={<GraphColumnCursor />} />
        {selectedDate ? (
          <ReferenceLine
            x={selectedDate}
            stroke="var(--graph-column-highlight)"
            strokeOpacity={1}
            strokeWidth={24}
          />
        ) : null}
        <Bar
          dataKey="value"
          fill="hsl(var(--accent))"
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        >
          {displayData.map((point) => (
            <Cell
              key={point.date}
              fill="hsl(var(--accent))"
              fillOpacity={
                point.isSpacer
                  ? 0
                  : selectedDate == null || selectedDate === point.date
                    ? 0.95
                    : 0.28
              }
            />
          ))}
        </Bar>
      </BarChart>
    );

  const yAxisLabelNode = canSelectMetric ? (
    <AxisLabelSelect
      items={metricOptions}
      value={selectedMetricOption}
      onValueChange={onDataTypeChange}
      ariaLabel={`Y-axis metric: ${label}. Click to change.`}
    />
  ) : (
    <span>{label}</span>
  );

  const xAxisLabelNode = canSelectXAxis ? (
    <AxisLabelSelect
      items={resolvedXAxisOptions}
      value={selectedXAxisOption}
      onValueChange={onXAxisModeChange}
      ariaLabel={`X-axis: ${selectedXAxisOption?.label ?? "Date"}. Click to change.`}
      align="center"
    />
  ) : null;

  const dateRangeNode = canSelectDateRange ? (
    <AxisLabelSelect
      items={resolvedDateRangeOptions}
      value={selectedDateRangeOption}
      onValueChange={onDateRangeChange}
      ariaLabel={`Date range: ${selectedDateRangeOption?.label ?? "All time"}. Click to change.`}
      align="end"
    />
  ) : dateRangeLabel ? (
    <span className="shrink-0">{dateRangeLabel}</span>
  ) : null;

  return (
    <div className={cn("flex flex-col", className)}>
      {canSelectMetric || dateRangeNode ? (
        <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          {canSelectMetric || yAxisLabel ? yAxisLabelNode : <span />}
          {dateRangeNode}
        </div>
      ) : null}
      <div className={cn("w-full", compact ? "h-[168px]" : "h-[280px]")}>
        <ResponsiveContainer width="100%" height="100%">
          {chartContent}
        </ResponsiveContainer>
      </div>
      {xAxisLabelNode ? (
        <div className="-mt-1 flex justify-center text-sm text-muted-foreground">
          {xAxisLabelNode}
        </div>
      ) : null}
    </div>
  );
}
