import type { DailyProgressSeriesPoint } from "@/app/api/ucat/progress/series/route";
import { calculateRecentWeightedMockScore } from "../mock-progress-insights";

function point(
  date: string,
  score: number,
  count = 1,
): DailyProgressSeriesPoint {
  return {
    date,
    attemptCount: count,
    scaledScoreSum: score * count,
    scaledScoreCount: count,
    scorePointsSum: 0,
    totalPointsSum: 0,
    timeTakenSecondsSum: 0,
    timeTakenCount: 0,
    timeLimitSecondsSum: 0,
    examSpeedPercentSum: 0,
    examSpeedCount: 0,
  };
}

describe("calculateRecentWeightedMockScore", () => {
  it("favours a recent mock over an older score", () => {
    const weighted = calculateRecentWeightedMockScore([
      point("2026-01-01", 1800),
      point("2026-05-01", 2400),
    ]);
    expect(weighted).toBeGreaterThan(2100);
  });

  it("returns null without scored mocks", () => {
    expect(calculateRecentWeightedMockScore([])).toBeNull();
  });
});
