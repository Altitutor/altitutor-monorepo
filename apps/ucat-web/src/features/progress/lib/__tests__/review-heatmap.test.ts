import {
  addLocalDays,
  aggregateDailyActivity,
  buildReviewHeatmapWeeks,
  getSundayOnOrBefore,
  isoTimestampToLocalDateKey,
  localDateKey,
  reviewHeatmapIntensityLevel,
  startOfLocalDay,
} from "../review-heatmap";

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

  it("buildReviewHeatmapWeeks returns fixed column count and marks future days", () => {
    const now = new Date(2025, 2, 22); // Mar 22 2025 local
    const weeks = buildReviewHeatmapWeeks(
      now,
      { questionAttempts: [], setAttempts: [] },
      53,
    );
    expect(weeks).toHaveLength(53);
    expect(weeks[0]).toHaveLength(7);
    const flat = weeks.flat();
    const future = flat.filter((d) => d.isFuture);
    const pastOrToday = flat.filter((d) => !d.isFuture);
    expect(future.length + pastOrToday.length).toBe(53 * 7);
    expect(pastOrToday.some((d) => d.dateKey === localDateKey(now))).toBe(true);
    expect(future.every((d) => d.questionAttempts === 0)).toBe(true);
  });

  it("getSundayOnOrBefore returns same week Sunday", () => {
    const wed = new Date(2025, 2, 19); // Wed Mar 19 2025
    const sun = getSundayOnOrBefore(wed);
    expect(sun.getDay()).toBe(0);
    expect(localDateKey(sun)).toBe("2025-03-16");
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
