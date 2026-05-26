"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatTimeSeconds } from "../lib/format-time";

function formatXAxisDate(dateStr: string): string {
  try {
    return format(new Date(dateStr + "T12:00:00"), "MMM d");
  } catch {
    return dateStr;
  }
}

function getXAxisLabel(
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

export type ProgressGraphProps = {
  data: { date: string; value: number | null; label?: string }[];
  type: "line" | "bar";
  dataType: GraphDataType;
  dateRangeLabel?: string;
  className?: string;
  /** When true, scaled_score uses dynamic max from data. Pass yAxisMax for mock context. */
  isMockContext?: boolean;
  /** Max value for Y-axis when isMockContext (e.g. max scaled score across attempts). */
  yAxisMax?: number;
  projection?: {
    conservative: { date: string; value: number }[];
    realistic: { date: string; value: number }[];
    aggressive: { date: string; value: number }[];
  };
  targetScore?: number;
  testDate?: string;
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

export function ProgressGraph({
  data,
  type,
  dataType,
  dateRangeLabel,
  className,
  isMockContext = false,
  yAxisMax,
  projection,
  targetScore,
  testDate,
}: ProgressGraphProps) {
  type GraphLinePoint = {
    date: string;
    value: number | null;
    label?: string;
    projectionConservative?: number;
    projectionRealistic?: number;
    projectionAggressive?: number;
  };

  const hasAggregatedLabels = data.some((d) => d.label);
  const label = dataTypeLabels[dataType];
  const domain = getYAxisDomain(dataType, isMockContext, yAxisMax);
  const showProjection =
    type === "line" &&
    dataType === "scaled_score" &&
    !hasAggregatedLabels &&
    projection != null;

  const mergedLineData: GraphLinePoint[] = showProjection
    ? (() => {
        const byDate = new Map<string, GraphLinePoint>();
        for (const point of data) {
          byDate.set(point.date, { ...point, value: point.value });
        }
        for (const point of projection.conservative) {
          const current = byDate.get(point.date) ?? {
            date: point.date,
            value: null,
          };
          current.projectionConservative = point.value;
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
        for (const point of projection.aggressive) {
          const current = byDate.get(point.date) ?? {
            date: point.date,
            value: null,
          };
          current.projectionAggressive = point.value;
          byDate.set(point.date, current);
        }
        return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
      })()
    : data.map((point) => ({ ...point }));

  const projectionBaseLine =
    showProjection && mergedLineData.length > 0
      ? mergedLineData.map((point, index) => ({
          x: index,
          y: point.projectionConservative ?? point.projectionAggressive ?? 0,
        }))
      : undefined;

  const formatTooltipValue = (value: number | null | undefined): string => {
    if (value == null) return "—";
    if (dataType === "time_taken") return formatTimeSeconds(value); // value is in seconds
    return String(value);
  };

  const chartContent =
    type === "line" ? (
      <LineChart
        data={mergedLineData}
        margin={{
          top: 5,
          right: 5,
          left: 5,
          bottom: hasAggregatedLabels || data.length > 14 ? 60 : 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          angle={hasAggregatedLabels ? -45 : 0}
          tick={{
            fontSize: data.length > 14 ? 10 : 12,
            textAnchor: hasAggregatedLabels ? "end" : "middle",
          }}
          tickFormatter={(value, index) => getXAxisLabel(mergedLineData, index)}
          interval={0}
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
              | { date: string; label?: string }
              | undefined;
            const displayLabel = raw?.label ?? formatXAxisDate(l);
            return raw?.label
              ? `Period: ${displayLabel}`
              : `Date: ${displayLabel}`;
          }}
        />
        {showProjection ? (
          <>
            <Area
              type="monotone"
              dataKey="projectionAggressive"
              baseLine={projectionBaseLine}
              stroke="none"
              fill="hsl(var(--accent))"
              fillOpacity={0.12}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="projectionConservative"
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
              dataKey="projectionAggressive"
              stroke="hsl(var(--primary))"
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
            {targetScore != null ? (
              <ReferenceLine
                y={targetScore}
                stroke="hsl(var(--destructive))"
                strokeDasharray="4 4"
              />
            ) : null}
            {testDate ? (
              <ReferenceLine
                x={testDate}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
              />
            ) : null}
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
          top: 5,
          right: 5,
          left: 5,
          bottom: hasAggregatedLabels || data.length > 14 ? 60 : 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          angle={hasAggregatedLabels ? -45 : 0}
          tick={{
            fontSize: data.length > 14 ? 10 : 12,
            textAnchor: hasAggregatedLabels ? "end" : "middle",
          }}
          tickFormatter={(value, index) => getXAxisLabel(data, index)}
          interval={0}
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
              | { date: string; label?: string }
              | undefined;
            const displayLabel = raw?.label ?? formatXAxisDate(l);
            return raw?.label
              ? `Period: ${displayLabel}`
              : `Date: ${displayLabel}`;
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

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {dateRangeLabel ? (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{label}</span>
          <span>{dateRangeLabel}</span>
        </div>
      ) : null}
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {chartContent}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
