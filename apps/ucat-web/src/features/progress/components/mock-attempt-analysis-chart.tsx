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
import { AttemptChartSetLabelsRow } from "./attempt-chart-set-labels-row";
import { formatTimeSeconds } from "../lib/format-time";
import {
  ATTEMPT_CHART_LAYOUT,
  computeSetRanges,
  computeStemRanges,
  getAnnotationBaselineY,
  getChartBottomMargin,
  getDividerEndY,
  getStemLabelY,
  shouldRenderStemDivider,
  shouldRenderStemLabel,
} from "../lib/attempt-analysis-chart-layout";
import { cn } from "@/lib/utils";

export type MockQuestionAttemptForChart = {
  questionNumber: number;
  /** 1-based stem index within the set */
  stemIndex?: number;
  timeSpentSeconds: number | null;
  result: "correct" | "partial" | "incorrect" | "not_attempted";
};

export type SetInfoForChart = {
  questionSetName: string | null;
};

type MockAttemptAnalysisChartProps = {
  data: MockQuestionAttemptForChart[];
  /** 0-based indices after which to draw set divider (last question index of each set except final) */
  setBoundaryIndices: number[];
  /** Set names for section labels (one per set, in order) */
  sets: SetInfoForChart[];
  className?: string;
  selectedQuestionIndex?: number;
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

const CHART_BOTTOM_MARGIN = getChartBottomMargin({ includeSetLabelRow: false });
const CHART_MARGIN_LEFT = 5;
const PLOT_HEIGHT = 300;

export function MockAttemptAnalysisChart({
  data,
  setBoundaryIndices,
  sets,
  className,
  selectedQuestionIndex = -1,
  onBarClick,
}: MockAttemptAnalysisChartProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const chartData = data.map((d, i) => {
    const prevStem = data[i - 1]?.stemIndex;
    const isStemStart = d.stemIndex != null && d.stemIndex !== prevStem;
    return {
      index: i,
      name: String(d.questionNumber),
      value: d.timeSpentSeconds ?? 0,
      result: d.result,
      stemIndex: d.stemIndex,
      isStemStart: !!isStemStart,
    };
  });

  const stemRanges = computeStemRanges(chartData);
  const setRanges = computeSetRanges(
    chartData.length,
    setBoundaryIndices,
    sets.map((s) => s.questionSetName),
  );

  const maxTime = Math.max(...chartData.map((d) => d.value), 1);
  const chartWidth = Math.max(600, chartData.length * 24);
  const marginHorizontal = 10;
  const barWidth =
    chartData.length > 0
      ? (chartWidth - marginHorizontal) / chartData.length
      : 24;
  const yAxisWidth = 52;

  const yAxisTicks = [0, 0.25, 0.5, 0.75, 1].map((t) =>
    Math.round(t * maxTime * 1.1),
  );

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
    const chartHeight = parentViewBox?.height ?? PLOT_HEIGHT;
    const isSelected = index === selectedQuestionIndex;
    const fill = RESULT_COLORS[payload.result];
    const barBottom = y + height;
    const baselineY = getAnnotationBaselineY(chartHeight, CHART_BOTTOM_MARGIN);
    const stemLabelY = getStemLabelY(baselineY);
    const dividerEndY = getDividerEndY(baselineY);

    const stemRange = stemRanges.find((r) => r.startIndex === index);
    const showStemLabel =
      stemRange != null && shouldRenderStemLabel(stemRange, index);
    const stemLabelCenterX = showStemLabel
      ? x + ((stemRange.endIndex - stemRange.startIndex + 1) * width) / 2
      : 0;
    const showStemDivider =
      stemRange != null && shouldRenderStemDivider(stemRange, index);

    const setRange = setRanges.find((r) => r.startIndex === index);
    const showSetDivider = setRange != null && setRange.setIndex > 0;

    return (
      <g key={index}>
        {showSetDivider && (
          <line
            x1={x}
            y1={barBottom}
            x2={x}
            y2={dividerEndY}
            stroke="hsl(var(--border))"
            strokeWidth={2}
            strokeDasharray="4 2"
          />
        )}
        {showStemDivider && (
          <line
            x1={x}
            y1={barBottom}
            x2={x}
            y2={dividerEndY}
            stroke="hsl(var(--muted-foreground) / 0.8)"
            strokeWidth={1}
            strokeDasharray="2 2"
          />
        )}
        {showStemLabel && stemRange && (
          <text
            x={stemLabelCenterX}
            y={stemLabelY}
            textAnchor="middle"
            fontSize={ATTEMPT_CHART_LAYOUT.stemLabelFontSize}
            fill="hsl(var(--muted-foreground) / 0.8)"
          >
            Stem {stemRange.stemIndex}
          </text>
        )}
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
      <div className="flex min-h-0 pt-6" style={{ height: PLOT_HEIGHT + ATTEMPT_CHART_LAYOUT.setLabelRowHeight + 24 }}>
        <div
          className="flex shrink-0 flex-col justify-between border-r border-border bg-card pr-2 pt-1 text-right text-xs text-muted-foreground"
          style={{
            width: yAxisWidth,
            paddingBottom:
              ATTEMPT_CHART_LAYOUT.setLabelRowHeight + CHART_BOTTOM_MARGIN,
          }}
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
          <div style={{ width: chartWidth, minWidth: chartWidth }}>
            <div style={{ height: PLOT_HEIGHT }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{
                    top: 5,
                    right: 5,
                    left: CHART_MARGIN_LEFT,
                    bottom: CHART_BOTTOM_MARGIN,
                  }}
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
                            dy={ATTEMPT_CHART_LAYOUT.questionNumberOffset}
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
                      const tooltipProps = props as {
                        index?: number;
                        payload?: {
                          name: string;
                          stemIndex?: number;
                          result:
                            | "correct"
                            | "partial"
                            | "incorrect"
                            | "not_attempted";
                        };
                      };
                      const barIndex = tooltipProps.index ?? 0;
                      const payload = tooltipProps.payload;
                      if (!payload) {
                        return [formatTimeSeconds(value ?? 0), ""];
                      }
                      const setRange = setRanges.find((r) =>
                        indexInRange(barIndex, r),
                      );
                      const stemLabel =
                        payload.stemIndex != null
                          ? ` · Stem ${payload.stemIndex}`
                          : "";
                      return [
                        `${formatTimeSeconds(value ?? 0)} · ${RESULT_LABELS[payload.result]}`,
                        `${setRange?.name ?? "Set"} Q${payload.name}${stemLabel}`,
                      ];
                    }}
                    labelFormatter={() => ""}
                  />
                  <Bar
                    dataKey="value"
                    barSize={barWidth}
                    isAnimationActive
                    animationDuration={850}
                    animationEasing="ease-out"
                    shape={
                      renderBarShape as React.ComponentProps<typeof Bar>["shape"]
                    }
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <AttemptChartSetLabelsRow
              setRanges={setRanges}
              barWidth={barWidth}
              marginLeft={CHART_MARGIN_LEFT}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function indexInRange(
  index: number,
  range: { startIndex: number; endIndex: number },
) {
  return index >= range.startIndex && index <= range.endIndex;
}
