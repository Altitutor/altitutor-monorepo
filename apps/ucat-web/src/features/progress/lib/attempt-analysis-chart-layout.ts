export type StemRange = {
  stemIndex: number;
  startIndex: number;
  endIndex: number;
};

export type SetRange = {
  setIndex: number;
  startIndex: number;
  endIndex: number;
  name: string;
};

/** Vertical layout below the plot area (offsets from the x-axis baseline). */
export const ATTEMPT_CHART_LAYOUT = {
  questionNumberOffset: 12,
  /** Dividers stop just above the stem-label row. */
  dividerEndOffset: 22,
  stemLabelOffset: 30,
  setLabelOffset: 46,
  stemLabelFontSize: 10,
  setLabelFontSize: 11,
  setLabelRowHeight: 24,
  /** Dedicated row for the visible horizontal scrollbar (keeps set labels above it). */
  scrollbarTrackHeight: 14,
} as const;

/** Hide native scrollbars while keeping overflow scroll (wheel / touch). */
export const ATTEMPT_CHART_HIDDEN_SCROLLBAR_CLASS =
  "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

/** Theme-aware Recharts tooltip styles (default tooltip text is black). */
export const ATTEMPT_CHART_TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--foreground))",
  },
  itemStyle: {
    color: "hsl(var(--foreground))",
  },
  labelStyle: {
    color: "hsl(var(--muted-foreground))",
  },
} as const;

export function computeStemRanges(
  chartData: Array<{ stemIndex?: number }>,
): StemRange[] {
  const ranges: StemRange[] = [];
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
}

export function computeSetRanges(
  chartLength: number,
  setBoundaryIndices: number[],
  setNames: Array<string | null | undefined>,
): SetRange[] {
  if (chartLength === 0) return [];

  const ranges: SetRange[] = [];
  let startIndex = 0;

  setBoundaryIndices.forEach((endIndex, i) => {
    ranges.push({
      setIndex: i,
      startIndex,
      endIndex,
      name: setNames[i] ?? `Set ${i + 1}`,
    });
    startIndex = endIndex + 1;
  });

  ranges.push({
    setIndex: setBoundaryIndices.length,
    startIndex,
    endIndex: chartLength - 1,
    name: setNames[setBoundaryIndices.length] ?? `Set ${setBoundaryIndices.length + 1}`,
  });

  return ranges;
}

export function getStemQuestionCount(range: StemRange): number {
  return range.endIndex - range.startIndex + 1;
}

export function getAnnotationBaselineY(
  chartHeight: number,
  bottomMargin: number,
): number {
  return chartHeight - bottomMargin;
}

export function getDividerEndY(baselineY: number): number {
  return baselineY + ATTEMPT_CHART_LAYOUT.dividerEndOffset;
}

export function getStemLabelY(baselineY: number): number {
  return baselineY + ATTEMPT_CHART_LAYOUT.stemLabelOffset;
}

export function shouldRenderStemDivider(
  stemRange: StemRange,
  barIndex: number,
): boolean {
  return stemRange.startIndex === barIndex && stemRange.stemIndex > 1;
}

/** Only label stems with more than one question — avoids overlap on single-bar stems. */
export function shouldRenderStemLabel(
  stemRange: StemRange,
  barIndex: number,
): boolean {
  return (
    stemRange.startIndex === barIndex && getStemQuestionCount(stemRange) > 1
  );
}

export function getChartBottomMargin(options: { includeSetLabelRow?: boolean }) {
  const stemRowEnd =
    ATTEMPT_CHART_LAYOUT.stemLabelOffset + ATTEMPT_CHART_LAYOUT.stemLabelFontSize + 6;
  if (options.includeSetLabelRow) {
    return (
      ATTEMPT_CHART_LAYOUT.setLabelOffset +
      ATTEMPT_CHART_LAYOUT.setLabelFontSize +
      8
    );
  }
  return stemRowEnd;
}
