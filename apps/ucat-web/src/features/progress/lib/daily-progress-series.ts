import type { DailyProgressSeriesPoint } from "@/app/api/ucat/progress/series/route";
import type { GraphDataType } from "../components/progress-graph";
import {
  formatWeekRangeLabel,
  formatWeekStartLabel,
  getBucketKey,
  getBucketKeysBetween,
  getGraphBucketDays,
  getTimeFrameRange,
  type GraphDateRange,
} from "./progress-mode";
import type { ProgressGraphPoint } from "./progress-data-utils";

type AdditivePoint = Omit<DailyProgressSeriesPoint, "date">;

const ZERO: AdditivePoint = {
  attemptCount: 0,
  scaledScoreSum: 0,
  scaledScoreCount: 0,
  scorePointsSum: 0,
  totalPointsSum: 0,
  timeTakenSecondsSum: 0,
  timeTakenCount: 0,
  timeLimitSecondsSum: 0,
  examSpeedPercentSum: 0,
  examSpeedCount: 0,
};

function add(target: AdditivePoint, point: DailyProgressSeriesPoint) {
  for (const key of Object.keys(ZERO) as (keyof AdditivePoint)[]) {
    target[key] += point[key];
  }
}

function metricValue(point: AdditivePoint, metric: GraphDataType): number | null {
  if (metric === "attempt_count") return point.attemptCount;
  if (metric === "scaled_score") {
    return point.scaledScoreCount > 0
      ? point.scaledScoreSum / point.scaledScoreCount
      : null;
  }
  if (metric === "percentage") {
    return point.totalPointsSum > 0
      ? (point.scorePointsSum / point.totalPointsSum) * 100
      : null;
  }
  if (metric === "time_taken") {
    return point.timeTakenCount > 0
      ? point.timeTakenSecondsSum / point.timeTakenCount
      : null;
  }
  return point.examSpeedCount > 0
    ? point.examSpeedPercentSum / point.examSpeedCount
    : null;
}

export function buildDailyProgressGraphData(
  points: DailyProgressSeriesPoint[],
  metric: GraphDataType,
  dateRange: GraphDateRange,
): ProgressGraphPoint[] {
  if (points.length === 0) return [];

  const parsed = points.map((point) => ({
    point,
    date: new Date(`${point.date}T12:00:00`),
  }));
  const range =
    dateRange === "all"
      ? {
          start: parsed[0].date,
          end: parsed[parsed.length - 1].date,
        }
      : getTimeFrameRange(Number(dateRange));
  const filtered = parsed.filter(
    ({ date }) => date >= range.start && date <= range.end,
  );
  const days =
    Math.ceil((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1;
  const bucket = getGraphBucketDays(days);
  const totals = new Map<string, AdditivePoint>();
  for (const { point, date } of filtered) {
    const key = getBucketKey(date, bucket);
    const aggregate = totals.get(key) ?? { ...ZERO };
    add(aggregate, point);
    totals.set(key, aggregate);
  }

  return getBucketKeysBetween(range.start, range.end, bucket).map((date) => ({
    date,
    value: totals.has(date) ? metricValue(totals.get(date)!, metric) : null,
    label: bucket === "week" ? formatWeekStartLabel(date) : undefined,
    tooltipLabel:
      bucket === "week" ? `Period: ${formatWeekRangeLabel(date)}` : undefined,
  }));
}
