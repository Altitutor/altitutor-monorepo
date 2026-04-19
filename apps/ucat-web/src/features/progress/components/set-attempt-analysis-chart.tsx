"use client";

import React, { useEffect, useRef } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTimeSeconds } from "../lib/format-time";
import { cn } from "@/lib/utils";

export type QuestionAttemptForChart = {
  questionNumber: number;
  /** 1-based stem index within the set */
  stemIndex?: number;
  timeSpentSeconds: number | null;
  result: "correct" | "partial" | "incorrect" | "not_attempted";
};

type SetAttemptAnalysisChartProps = {
  data: QuestionAttemptForChart[];
  className?: string;
  /** 0-based index of the currently selected/viewing question */
  selectedQuestionIndex?: number;
  /** Called when a bar/column is clicked with the 0-based question index */
  onBarClick?: (questionIndex: number) => void;
};

const RESULT_COLORS: Record<
  "correct" | "partial" | "incorrect" | "not_attempted",
  string
> = {
  correct: "hsl(142 76% 36%)",
  partial: "hsl(48 96% 53%)",
  incorrect: "hsl(0 84% 60%)",
  not_attempted: "hsl(var(--muted-foreground) / 0.3)",
};

const RESULT_LABELS: Record<
  "correct" | "partial" | "incorrect" | "not_attempted",
  string
> = {
  correct: "Correct",
  partial: "Partial",
  incorrect: "Incorrect",
  not_attempted: "Not attempted",
};

export function SetAttemptAnalysisChart({
  data,
  className,
  selectedQuestionIndex = -1,
  onBarClick,
}: SetAttemptAnalysisChartProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const chartData = data.map((d, i) => {
    const prevStem = data[i - 1]?.stemIndex;
    const isStemStart = d.stemIndex != null && d.stemIndex !== prevStem;
    return {
      name: String(d.questionNumber),
      value: d.timeSpentSeconds ?? 0,
      result: d.result,
      stemIndex: d.stemIndex,
      isStemStart: !!isStemStart,
    };
  });

  // Compute stem ranges for centred labels and divider lines
  const stemRanges = (() => {
    const ranges: {
      stemIndex: number;
      startIndex: number;
      endIndex: number;
    }[] = [];
    let currentStem: number | null = null;
    let startIndex = 0;
    chartData.forEach((entry, i) => {
      if (entry.stemIndex != null && entry.stemIndex !== currentStem) {
        if (currentStem != null) {
          ranges.push({ stemIndex: currentStem, startIndex, endIndex: i - 1 });
        }
        currentStem = entry.stemIndex;
        startIndex = i;
      }
    });
    if (currentStem != null) {
      ranges.push({
        stemIndex: currentStem,
        startIndex,
        endIndex: chartData.length - 1,
      });
    }
    return ranges;
  })();

  const maxTime = Math.max(...chartData.map((d) => d.value), 1);
  const chartWidth = Math.max(600, chartData.length * 24);
  const marginHorizontal = 10; // left 5 + right 5
  // Use full category width so bars touch with no gaps
  const barWidth =
    chartData.length > 0
      ? (chartWidth - marginHorizontal) / chartData.length
      : 24;
  const yAxisWidth = 52;

  const yAxisTicks = [0, 0.25, 0.5, 0.75, 1].map((t) =>
    Math.round(t * maxTime * 1.1),
  );

  // Auto-scroll chart so selected column is visible
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || selectedQuestionIndex < 0 || chartData.length === 0)
      return;
    const colWidth = chartWidth / chartData.length;
    const targetScroll =
      selectedQuestionIndex * colWidth -
      container.clientWidth / 2 +
      colWidth / 2;
    container.scrollTo({
      left: Math.max(0, targetScroll),
      behavior: "smooth",
    });
  }, [selectedQuestionIndex, chartData.length, chartWidth]);

  const renderBarShape = (props: {
    x: number;
    y: number;
    width: number;
    height: number;
    payload: { result: "correct" | "partial" | "incorrect" | "not_attempted" };
    index: number;
    parentViewBox?: { height?: number };
  }) => {
    const { x, y, width, height, payload, index, parentViewBox } = props;
    const chartHeight = parentViewBox?.height ?? 300;
    const isSelected = index === selectedQuestionIndex;
    const fill = RESULT_COLORS[payload.result];
    const entry = chartData[index];
    const showStemDivider = entry?.isStemStart && (entry?.stemIndex ?? 1) > 1;

    // Render stem label when this is the first bar of a stem (avoids Customized timing issues)
    const stemRange = stemRanges.find((r) => r.startIndex === index);
    const showStemLabel = stemRange != null;
    const stemLabelCenterX = showStemLabel
      ? x + ((stemRange.endIndex - stemRange.startIndex + 1) * width) / 2
      : 0;
    const stemLabelY = y + height + 36;

    return (
      <g key={index}>
        {/* Stem divider line - vertical line at left edge of first bar of new stem, only below x-axis */}
        {showStemDivider && (
          <line
            x1={x}
            y1={y + height}
            x2={x}
            y2={chartHeight}
            stroke="hsl(var(--muted-foreground) / 0.8)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}
        {/* Stem label - rendered from first bar of each stem */}
        {showStemLabel && stemRange && (
          <text
            x={stemLabelCenterX}
            y={stemLabelY}
            textAnchor="middle"
            fontSize={10}
            fill="hsl(var(--muted-foreground) / 0.8)"
          >
            Stem {stemRange.stemIndex}
          </text>
        )}
        {/* Full-height transparent clickable area */}
        <rect
          x={x}
          y={0}
          width={width}
          height={chartHeight}
          fill="transparent"
          className={onBarClick ? "cursor-pointer" : ""}
          style={
            isSelected ? { fill: "hsl(var(--primary) / 0.15)" } : undefined
          }
          onClick={() => onBarClick?.(index)}
          onMouseEnter={(e) => {
            if (onBarClick) {
              e.currentTarget.style.fill =
                "hsl(var(--muted-foreground) / 0.08)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.fill = isSelected
              ? "hsl(var(--primary) / 0.15)"
              : "transparent";
          }}
        />
        {/* Visible bar with rounded top corners */}
        {height > 0 && (
          <path
            d={(() => {
              const r = Math.min(4, width / 2, height / 2);
              const x0 = x;
              const y0 = y;
              const x1 = x + width;
              const y1 = y + height;
              return `M ${x0} ${y1} L ${x1} ${y1} L ${x1} ${y0 + r} Q ${x1} ${y0} ${x1 - r} ${y0} L ${x0 + r} ${y0} Q ${x0} ${y0} ${x0} ${y0 + r} Z`;
            })()}
            fill={fill}
            className={onBarClick ? "cursor-pointer" : ""}
            onClick={() => onBarClick?.(index)}
          />
        )}
      </g>
    );
  };

  return (
    <div className={cn("relative flex min-w-0 flex-col gap-2", className)}>
      <div className="text-sm text-muted-foreground">
        Time taken per question
      </div>
      <div className="absolute right-0 top-0 flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs">
        {(["correct", "partial", "incorrect", "not_attempted"] as const).map(
          (r) => (
            <span key={r} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: RESULT_COLORS[r] }}
              />
              {RESULT_LABELS[r]}
            </span>
          ),
        )}
      </div>
      <div className="flex h-[320px] min-h-0 pt-6">
        <div
          className="flex shrink-0 flex-col justify-between border-r border-border bg-card pr-2 pt-1 pb-8 text-right text-xs text-muted-foreground"
          style={{ width: yAxisWidth }}
        >
          {yAxisTicks.map((t) => (
            <span key={t} className="tabular-nums">
              {formatTimeSeconds(t)}
            </span>
          ))}
        </div>
        <div
          ref={scrollContainerRef}
          className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
        >
          <div
            style={{ width: chartWidth, minWidth: chartWidth }}
            className="h-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 5, right: 5, left: 5, bottom: 36 }}
                barCategoryGap={0}
                barGap={0}
              >
                <XAxis
                  dataKey="name"
                  stroke="currentColor"
                  className="text-muted-foreground"
                  interval={0}
                  tick={({ x, y, index }) => {
                    const entry = chartData[index];
                    if (!entry) return null;
                    return (
                      <g transform={`translate(${x}, ${y})`}>
                        <text
                          x={0}
                          y={0}
                          dy={8}
                          textAnchor="middle"
                          fontSize={11}
                          fill="hsl(var(--muted-foreground))"
                        >
                          {entry.name}
                        </text>
                      </g>
                    );
                  }}
                />
                <YAxis
                  domain={[0, maxTime * 1.1]}
                  width={0}
                  tick={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number | undefined, _name, props) => {
                    const payload = props.payload as {
                      name: string;
                      result:
                        | "correct"
                        | "partial"
                        | "incorrect"
                        | "not_attempted";
                    };
                    return [
                      `${formatTimeSeconds(value ?? 0)} · ${RESULT_LABELS[payload.result]}`,
                      `Q${payload.name}`,
                    ];
                  }}
                  labelFormatter={(l) => `Question ${l}`}
                />
                <Bar
                  dataKey="value"
                  barSize={barWidth}
                  isAnimationActive
                  animationDuration={600}
                  animationEasing="ease-out"
                  shape={
                    renderBarShape as React.ComponentProps<typeof Bar>["shape"]
                  }
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
