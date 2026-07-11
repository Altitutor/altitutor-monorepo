"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { SearchableSelect } from "@altitutor/ui";
import { cn } from "@/lib/utils";
import { formatTimeSeconds } from "../lib/format-time";
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
  index: number,
): string {
  const point = data[index];
  if (point?.label) return point.label;
  return formatXAxisDate(point?.date ?? "");
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
  }[];
  type: "line" | "bar";
  dataType: GraphDataType;
  dateRangeLabel?: string;
  className?: string;
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
};

const dataTypeLabels: Record<GraphDataType, string> = {
  scaled_score: "Scaled score",
  percentage: "Percentage (%)",
  time_taken: "Time taken",
  exam_speed: "Exam speed (%)",
  question_speed: "Question speed (%)",
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

export function ProgressGraph({
  data,
  type,
  dataType,
  dateRangeLabel,
  className,
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
}: ProgressGraphProps) {
  type GraphLinePoint = {
    date: string;
    value: number | null;
    label?: string;
    tooltipLabel?: string;
    projectionPessimistic?: number;
    projectionRealistic?: number;
    projectionOptimistic?: number;
  };

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
      ? (resolvedDateRangeOptions.find((option) => option.value === dateRange) ??
        null)
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
    if (
      dataType === "percentage" ||
      dataType === "exam_speed" ||
      dataType === "question_speed"
    ) {
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

  const needsAngledTicks =
    (hasCustomTickLabels && xAxisMode === "date") || data.length > 14;
  const xTickInterval =
    data.length > 24 ? Math.max(0, Math.ceil(data.length / 12) - 1) : 0;
  // Keep only enough room for tick labels; the X-axis mode label sits outside the chart.
  const chartBottomMargin = needsAngledTicks ? 42 : 4;
  const chartTopMargin = 16;

  const chartContent =
    type === "line" ? (
      <LineChart
        data={mergedLineData}
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
          angle={needsAngledTicks ? -45 : 0}
          tick={{
            fontSize: data.length > 14 ? 10 : 12,
            textAnchor: needsAngledTicks ? "end" : "middle",
          }}
          tickFormatter={(_value, index) =>
            getXAxisTickLabel(mergedLineData, index)
          }
          interval={xTickInterval}
          stroke="currentColor"
          className="text-muted-foreground"
        />
        <YAxis
          domain={domain}
          tick={{ fontSize: 12 }}
          stroke="currentColor"
          className="text-muted-foreground"
          tickFormatter={
            dataType === "time_taken" ? (v) => formatTimeSeconds(v) : undefined
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
          formatter={(value: number | undefined) => [
            formatTooltipValue(value),
            label,
          ]}
          labelFormatter={(l, payload) => {
            const raw = payload?.[0]?.payload as
              | { date: string; label?: string; tooltipLabel?: string }
              | undefined;
            return formatTooltipLabel(l, raw);
          }}
        />
        {showProjection ? (
          <>
            <Area
              type="monotone"
              dataKey="projectionOptimistic"
              baseLine={projectionBaseLine}
              stroke="none"
              fill="hsl(var(--accent))"
              fillOpacity={0.12}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="projectionPessimistic"
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="projectionRealistic"
              stroke="hsl(var(--accent))"
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="projectionOptimistic"
              stroke="hsl(var(--primary))"
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
          </>
        ) : null}
        <Line
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--accent))"
          strokeWidth={2}
          dot={{ fill: "hsl(var(--accent))", r: 4 }}
          activeDot={{ r: 6 }}
          connectNulls={true}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-out"
        />
      </LineChart>
    ) : (
      <BarChart
        data={data}
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
          angle={needsAngledTicks ? -45 : 0}
          tick={{
            fontSize: data.length > 14 ? 10 : 12,
            textAnchor: needsAngledTicks ? "end" : "middle",
          }}
          tickFormatter={(_value, index) => getXAxisTickLabel(data, index)}
          interval={xTickInterval}
          stroke="currentColor"
          className="text-muted-foreground"
        />
        <YAxis
          domain={domain}
          tick={{ fontSize: 12 }}
          stroke="currentColor"
          className="text-muted-foreground"
          tickFormatter={
            dataType === "time_taken" ? (v) => formatTimeSeconds(v) : undefined
          }
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
          formatter={(value: number | undefined) => [
            formatTooltipValue(value),
            label,
          ]}
          labelFormatter={(l, payload) => {
            const raw = payload?.[0]?.payload as
              | { date: string; label?: string; tooltipLabel?: string }
              | undefined;
            return formatTooltipLabel(l, raw);
          }}
        />
        <Bar
          dataKey="value"
          fill="hsl(var(--accent))"
          radius={[4, 4, 0, 0]}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-out"
        />
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
      <div className="h-[280px] w-full">
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
