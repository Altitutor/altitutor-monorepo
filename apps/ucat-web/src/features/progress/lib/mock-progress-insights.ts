import type { DailyProgressSeriesPoint } from "@/app/api/ucat/progress/series/route";

const RECENCY_HALF_LIFE_DAYS = 60;

export function calculateRecentWeightedMockScore(
  points: DailyProgressSeriesPoint[],
): number | null {
  const scored = points.filter((point) => point.scaledScoreCount > 0);
  const latestDate = scored.at(-1)?.date;
  if (!latestDate) return null;

  const latestTime = new Date(`${latestDate}T12:00:00.000Z`).getTime();
  let weightedScore = 0;
  let totalWeight = 0;
  for (const point of scored) {
    const pointTime = new Date(`${point.date}T12:00:00.000Z`).getTime();
    const ageDays = Math.max(0, (latestTime - pointTime) / 86_400_000);
    const recencyWeight = Math.pow(0.5, ageDays / RECENCY_HALF_LIFE_DAYS);
    const weight = recencyWeight * point.scaledScoreCount;
    weightedScore += (point.scaledScoreSum / point.scaledScoreCount) * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : null;
}
