import { buildDailyProgressGraphData } from "../daily-progress-series";
import type { DailyProgressSeriesPoint } from "@/app/api/ucat/progress/series/route";

function point(
  date: string,
  scorePointsSum: number,
  totalPointsSum: number,
  attemptCount = 1,
): DailyProgressSeriesPoint {
  return {
    date,
    attemptCount,
    scaledScoreSum: 0,
    scaledScoreCount: 0,
    scorePointsSum,
    totalPointsSum,
    timeTakenSecondsSum: 0,
    timeTakenCount: 0,
    timeLimitSecondsSum: 0,
    examSpeedPercentSum: 0,
    examSpeedCount: 0,
  };
}

describe("buildDailyProgressGraphData", () => {
  it("combines additive totals instead of averaging daily percentages", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-03T12:00:00Z"));
    const result = buildDailyProgressGraphData(
      [point("2026-01-01", 1, 1), point("2026-01-02", 0, 9)],
      "percentage",
      "90",
    );

    const values = result.flatMap((entry) =>
      entry.value == null ? [] : [entry.value],
    );
    expect(values).toContain(10);
    expect(values).not.toContain(50);
    jest.useRealTimers();
  });

  it("starts at the first bucket with scored data", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-10T12:00:00Z"));
    const result = buildDailyProgressGraphData(
      [point("2026-01-08", 3, 4)],
      "percentage",
      "90",
    );

    expect(result[0]?.date).toBe("2026-01-05");
    expect(result[0]?.value).toBe(75);
    jest.useRealTimers();
  });
});
