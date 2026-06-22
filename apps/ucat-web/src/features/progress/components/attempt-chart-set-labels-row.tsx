"use client";

import type { SetRange } from "../lib/attempt-analysis-chart-layout";
import { ATTEMPT_CHART_LAYOUT } from "../lib/attempt-analysis-chart-layout";

type AttemptChartSetLabelsRowProps = {
  setRanges: SetRange[];
  barWidth: number;
  marginLeft?: number;
};

/**
 * Horizontally scrollable set labels — each label sticks to the viewport centre
 * while its set segment is visible.
 */
export function AttemptChartSetLabelsRow({
  setRanges,
  barWidth,
  marginLeft = 5,
}: AttemptChartSetLabelsRowProps) {
  if (setRanges.length === 0) return null;

  return (
    <div
      className="flex shrink-0 items-start"
      style={{
        height: ATTEMPT_CHART_LAYOUT.setLabelRowHeight,
        marginLeft,
        marginRight: 5,
      }}
    >
      {setRanges.map((range) => {
        const width = (range.endIndex - range.startIndex + 1) * barWidth;
        return (
          <div
            key={range.setIndex}
            className="shrink-0"
            style={{ width }}
          >
            <div
              className="sticky left-1/2 w-max max-w-[min(100%,12rem)] -translate-x-1/2 truncate px-1 text-center text-[11px] font-medium text-muted-foreground"
              title={range.name}
            >
              {range.name}
            </div>
          </div>
        );
      })}
    </div>
  );
}
