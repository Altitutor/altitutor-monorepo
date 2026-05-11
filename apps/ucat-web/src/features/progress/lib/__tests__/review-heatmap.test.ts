import {
  addLocalDays,
  aggregateDailyActivity,
  buildReviewHeatmapModel,
  buildReviewHeatmapModelFromDaily,
  expandWeekToColumns,
  getMondayOnOrBefore,
  isoTimestampToLocalDateKey,
  localDateKey,
  reviewHeatmapIntensityLevel,
  startOfLocalDay,
  type HeatmapDay,
} from "../review-heatmap";

function heatmapDay(dateKey: string, isFuture = false): HeatmapDay {
  return {
    dateKey,
    questionAttempts: 0,
    setAttempts: 0,
    isFuture,
  };
}

describe("review-heatmap", () => {
  it("reviewHeatmapIntensityLevel buckets totals", () => {
    expect(reviewHeatmapIntensityLevel(0)).toBe(0);
    expect(reviewHeatmapIntensityLevel(1)).toBe(1);
    expect(reviewHeatmapIntensityLevel(2)).toBe(1);
    expect(reviewHeatmapIntensityLevel(3)).toBe(2);
    expect(reviewHeatmapIntensityLevel(5)).toBe(2);
    expect(reviewHeatmapIntensityLevel(6)).toBe(3);
    expect(reviewHeatmapIntensityLevel(9)).toBe(3);
    expect(reviewHeatmapIntensityLevel(10)).toBe(4);
  });

  it("aggregateDailyActivity counts questions and sets by local day", () => {
    const map = aggregateDailyActivity({
      questionAttempts: [{ attemptedAt: "2025-03-10T08:00:00.000Z" }],
      setAttempts: [
        {
          attemptedAt: "2025-03-10T10:00:00.000Z",
          completedAt: "2025-03-10T11:00:00.000Z",
        },
        {
          attemptedAt: "2025-03-11T00:00:00.000Z",
          completedAt: null,
        },
      ],
    });
    const q10 = isoTimestampToLocalDateKey("2025-03-10T08:00:00.000Z");
    const q11 = isoTimestampToLocalDateKey("2025-03-11T00:00:00.000Z");
    expect(q10).toBeTruthy();
    expect(q11).toBeTruthy();
    expect(map.get(q10!)).toEqual({ questionAttempts: 1, setAttempts: 1 });
    expect(map.get(q11!)).toEqual({ questionAttempts: 0, setAttempts: 1 });
  });

  it("expandWeekToColumns splits a week that crosses a month boundary", () => {
    const week: HeatmapDay[] = [
      heatmapDay("2025-03-31"),
      heatmapDay("2025-04-01"),
      heatmapDay("2025-04-02"),
      heatmapDay("2025-04-03"),
      heatmapDay("2025-04-04"),
      heatmapDay("2025-04-05"),
      heatmapDay("2025-04-06"),
    ];
    const cols = expandWeekToColumns(week);
    expect(cols).toHaveLength(2);
    expect(cols[0].monthKey).toBe("2025-03");
    expect(cols[1].monthKey).toBe("2025-04");
    expect(cols[0].cells[0]).toEqual({ kind: "day", day: week[0] });
    expect(cols[0].cells[1]).toEqual({ kind: "blank" });
    expect(cols[1].cells[0]).toEqual({ kind: "blank" });
    expect(cols[1].cells[1]).toEqual({ kind: "day", day: week[1] });
  });

  it("expandWeekToColumns keeps a single column when the week is one month", () => {
    const week: HeatmapDay[] = [
      heatmapDay("2025-04-07"),
      heatmapDay("2025-04-08"),
      heatmapDay("2025-04-09"),
      heatmapDay("2025-04-10"),
      heatmapDay("2025-04-11"),
      heatmapDay("2025-04-12"),
      heatmapDay("2025-04-13"),
    ];
    const cols = expandWeekToColumns(week);
    expect(cols).toHaveLength(1);
    expect(cols[0].cells.every((c) => c.kind === "day")).toBe(true);
  });

  it("buildReviewHeatmapModel uses Monday-first rows and includes today", () => {
    const now = new Date(2025, 2, 22); // Mar 22 2025 local (Saturday)
    const groups = buildReviewHeatmapModel(
      now,
      { questionAttempts: [], setAttempts: [] },
      { maxWeeks: 53 },
    );
    expect(groups.length).toBeGreaterThan(0);
    const allColumns = groups.flatMap((g) => g.columns);
    expect(allColumns.length).toBeGreaterThanOrEqual(53);
    const flatDays = allColumns
      .flatMap((c) => c.cells)
      .filter(
        (cell): cell is { kind: "day"; day: HeatmapDay } => cell.kind === "day",
      )
      .map((c) => c.day);
    expect(flatDays.some((d) => d.dateKey === localDateKey(now))).toBe(true);
    const future = flatDays.filter((d) => d.isFuture);
    expect(future.every((d) => d.questionAttempts === 0)).toBe(true);
  });

  it("buildReviewHeatmapModel clamps to startDate when shorter than maxWeeks", () => {
    const now = new Date(2025, 2, 22); // Sat Mar 22 2025
    const startDate = new Date(2025, 2, 1); // Sat Mar 1 2025 -> Monday Feb 24
    const groups = buildReviewHeatmapModel(
      now,
      { questionAttempts: [], setAttempts: [] },
      { startDate, maxWeeks: 53 },
    );
    const allColumns = groups.flatMap((g) => g.columns);
    // Mon Feb 24 → Mon Mar 17 = 4 week starts; Mon Mar 17 is the week of "now".
    // Splitting by month boundary (Feb→Mar) adds one extra column, giving 5.
    expect(allColumns.length).toBe(5);
    const flatKeys = allColumns
      .flatMap((c) => c.cells)
      .filter(
        (cell): cell is { kind: "day"; day: HeatmapDay } => cell.kind === "day",
      )
      .map((c) => c.day.dateKey);
    expect(flatKeys[0]).toBe("2025-02-24");
    expect(flatKeys.includes(localDateKey(now))).toBe(true);
    expect(flatKeys.every((k) => k >= "2025-02-24")).toBe(true);
  });

  it("buildReviewHeatmapModel returns empty when startDate is after now", () => {
    const now = new Date(2025, 2, 22);
    const startDate = new Date(2026, 0, 1);
    const groups = buildReviewHeatmapModel(
      now,
      { questionAttempts: [], setAttempts: [] },
      { startDate },
    );
    expect(groups).toEqual([]);
  });

  it("buildReviewHeatmapModelFromDaily applies pre-aggregated counts", () => {
    const now = new Date(2025, 2, 22); // Sat Mar 22 2025
    const groups = buildReviewHeatmapModelFromDaily(
      now,
      [
        { dateKey: "2025-03-19", questionAttempts: 4, setAttempts: 1 },
        { dateKey: "2025-03-22", questionAttempts: 7, setAttempts: 0 },
      ],
      { startDate: new Date(2025, 2, 17), maxWeeks: 53 },
    );
    const flatDays = groups
      .flatMap((g) => g.columns)
      .flatMap((c) => c.cells)
      .filter(
        (cell): cell is { kind: "day"; day: HeatmapDay } => cell.kind === "day",
      )
      .map((c) => c.day);
    const wed = flatDays.find((d) => d.dateKey === "2025-03-19");
    const sat = flatDays.find((d) => d.dateKey === "2025-03-22");
    expect(wed).toEqual({
      dateKey: "2025-03-19",
      questionAttempts: 4,
      setAttempts: 1,
      isFuture: false,
    });
    expect(sat).toEqual({
      dateKey: "2025-03-22",
      questionAttempts: 7,
      setAttempts: 0,
      isFuture: false,
    });
    const empty = flatDays.find((d) => d.dateKey === "2025-03-20");
    expect(empty).toEqual({
      dateKey: "2025-03-20",
      questionAttempts: 0,
      setAttempts: 0,
      isFuture: false,
    });
  });

  it("getMondayOnOrBefore returns Monday of the same week", () => {
    const wed = new Date(2025, 2, 19); // Wed Mar 19 2025
    const mon = getMondayOnOrBefore(wed);
    expect(mon.getDay()).toBe(1);
    expect(localDateKey(mon)).toBe("2025-03-17");
  });

  it("startOfLocalDay strips time", () => {
    const d = new Date(2025, 2, 22, 15, 30, 45);
    const s = startOfLocalDay(d);
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
  });

  it("addLocalDays crosses month boundary", () => {
    const base = new Date(2025, 2, 30);
    const next = addLocalDays(base, 5);
    expect(localDateKey(next)).toBe("2025-04-04");
  });
});
