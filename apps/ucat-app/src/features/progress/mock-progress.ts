import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
export type MockSeriesPoint = {
  date: string;
  scaledScoreSum: number;
  scaledScoreCount: number;
};
export function useMockSeries() {
  return useQuery({
    queryKey: ["mock-series"],
    queryFn: () =>
      api<{ points: MockSeriesPoint[] }>("/progress/series?source=mock"),
  });
}
export function weightedMockScore(points: MockSeriesPoint[]): number | null {
  const scored = points.filter((p) => p.scaledScoreCount > 0);
  const last = scored.at(-1);
  if (!last) return null;
  const lastTime = Date.parse(`${last.date}T12:00:00Z`);
  let sum = 0,
    weight = 0;
  for (const p of scored) {
    const age = Math.max(
      0,
      (lastTime - Date.parse(`${p.date}T12:00:00Z`)) / 86400000,
    );
    const w = Math.pow(0.5, age / 60) * p.scaledScoreCount;
    sum += (p.scaledScoreSum / p.scaledScoreCount) * w;
    weight += w;
  }
  return weight ? Math.round(sum / weight) : null;
}
