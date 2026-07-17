import type {
  ProjectionConfidence,
  ProjectionPoint,
  ScoreProjectionSnapshot,
  SectionScoreProjection,
  TotalScoreProjection,
} from "@/features/score-projection/types/score-projection";
import { daysBetween } from "@/features/study-plan/lib/dates";

const COGNITIVE_SECTION_NUMBERS = [1, 2, 3] as const;
export const DASHBOARD_HISTORY_WINDOW_DAYS = 60;
export const DASHBOARD_FORECAST_WINDOW_DAYS = 120;

export type DashboardTrajectoryStage =
  | "building_baseline"
  | "early_estimate"
  | "no_test_date"
  | "long_range"
  | "on_track"
  | "within_reach"
  | "needs_adjustment";

export type DashboardTrajectoryState = {
  stage: DashboardTrajectoryStage;
  currentEstimate: number | null;
  confidence: ProjectionConfidence | null;
  targetScore: number;
  testDay: number | null;
  forecastHorizonDays: number;
  forecastPoint: ProjectionPoint | null;
  projectedAtTest: ProjectionPoint | null;
  readySectionCount: number;
  missingSectionNames: string[];
};

export type DashboardTrajectoryChartPoint = {
  date: string;
  day: number;
  actual: number | null;
  pessimistic: number | null;
  realistic: number | null;
  optimistic: number | null;
  range: [number, number] | null;
};

function roundScore(value: number): number {
  return Math.round(value / 10) * 10;
}

export function interpolateProjectionAtDay(
  points: ProjectionPoint[],
  day: number,
): ProjectionPoint | null {
  if (points.length === 0) return null;
  const ordered = [...points].sort((left, right) => left.day - right.day);
  const boundedDay = Math.max(ordered[0]!.day, day);
  const exact = ordered.find((point) => point.day === boundedDay);
  if (exact) return exact;

  const upperIndex = ordered.findIndex((point) => point.day > boundedDay);
  if (upperIndex === -1) return ordered.at(-1) ?? null;
  const upper = ordered[upperIndex]!;
  const lower = ordered[Math.max(0, upperIndex - 1)]!;
  if (upper.day === lower.day) return lower;

  const progress = (boundedDay - lower.day) / (upper.day - lower.day);
  const interpolate = (from: number, to: number) =>
    roundScore(from + (to - from) * progress);

  return {
    day: boundedDay,
    date: new Date(
      new Date(`${lower.date}T00:00:00.000Z`).getTime() +
        (boundedDay - lower.day) * 86_400_000,
    )
      .toISOString()
      .slice(0, 10),
    pessimistic: interpolate(lower.pessimistic, upper.pessimistic),
    realistic: interpolate(lower.realistic, upper.realistic),
    optimistic: interpolate(lower.optimistic, upper.optimistic),
  };
}

export function resolveDashboardTrajectory({
  today,
  targetScore,
  testDate,
  total,
  sections,
}: {
  today: string;
  targetScore: number;
  testDate: string | null;
  total: TotalScoreProjection | null;
  sections: SectionScoreProjection[];
}): DashboardTrajectoryState {
  const cognitiveSections = COGNITIVE_SECTION_NUMBERS.map((sectionNumber) =>
    sections.find((section) => section.sectionNumber === sectionNumber),
  );
  const readySectionCount = cognitiveSections.filter(
    (section) => section?.currentEstimate != null,
  ).length;
  const missingSectionNames = cognitiveSections.flatMap((section) =>
    section && section.currentEstimate == null ? [section.sectionName] : [],
  );
  const forecastHorizonDays = Math.max(
    0,
    ...(total?.projection.map((point) => point.day) ?? []),
  );
  const forecastPoint =
    total && forecastHorizonDays > 0
      ? interpolateProjectionAtDay(total.projection, forecastHorizonDays)
      : null;

  if (
    !total ||
    total.currentEstimate == null ||
    total.projection.length === 0
  ) {
    return {
      stage: "building_baseline",
      currentEstimate: null,
      confidence: null,
      targetScore,
      testDay: testDate ? Math.max(0, daysBetween(today, testDate)) : null,
      forecastHorizonDays,
      forecastPoint,
      projectedAtTest: null,
      readySectionCount,
      missingSectionNames,
    };
  }

  if (!testDate) {
    return {
      stage: "no_test_date",
      currentEstimate: total.currentEstimate,
      confidence: total.confidence,
      targetScore,
      testDay: null,
      forecastHorizonDays,
      forecastPoint,
      projectedAtTest: null,
      readySectionCount,
      missingSectionNames,
    };
  }

  const testDay = Math.max(0, daysBetween(today, testDate));
  if (testDay > forecastHorizonDays) {
    return {
      stage: "long_range",
      currentEstimate: total.currentEstimate,
      confidence: total.confidence,
      targetScore,
      testDay,
      forecastHorizonDays,
      forecastPoint,
      projectedAtTest: null,
      readySectionCount,
      missingSectionNames,
    };
  }

  const projectedAtTest = interpolateProjectionAtDay(total.projection, testDay);
  if (!projectedAtTest || total.confidence === "low") {
    return {
      stage: "early_estimate",
      currentEstimate: total.currentEstimate,
      confidence: total.confidence,
      targetScore,
      testDay,
      forecastHorizonDays,
      forecastPoint,
      projectedAtTest,
      readySectionCount,
      missingSectionNames,
    };
  }

  const stage: DashboardTrajectoryStage =
    targetScore <= projectedAtTest.pessimistic
      ? "on_track"
      : targetScore <= projectedAtTest.optimistic
        ? "within_reach"
        : "needs_adjustment";

  return {
    stage,
    currentEstimate: total.currentEstimate,
    confidence: total.confidence,
    targetScore,
    testDay,
    forecastHorizonDays,
    forecastPoint,
    projectedAtTest,
    readySectionCount,
    missingSectionNames,
  };
}

export function buildDashboardTrajectoryChartData(
  total: TotalScoreProjection,
  snapshots: ScoreProjectionSnapshot[],
  today: string,
  highlightedPoint?: ProjectionPoint | null,
): DashboardTrajectoryChartPoint[] {
  const byDate = new Map<string, DashboardTrajectoryChartPoint>();

  for (const snapshot of snapshots) {
    byDate.set(snapshot.date, {
      date: snapshot.date,
      day: daysBetween(today, snapshot.date),
      actual: snapshot.currentEstimate,
      pessimistic: null,
      realistic: null,
      optimistic: null,
      range: null,
    });
  }

  const projectionPoints = highlightedPoint
    ? [...total.projection, highlightedPoint]
    : total.projection;
  for (const point of projectionPoints) {
    const current = byDate.get(point.date) ?? {
      date: point.date,
      day: daysBetween(today, point.date),
      actual: null,
      pessimistic: null,
      realistic: null,
      optimistic: null,
      range: null,
    };
    current.pessimistic = point.pessimistic;
    current.realistic = point.realistic;
    current.optimistic = point.optimistic;
    current.range = [point.pessimistic, point.optimistic];
    if (point.day === 0 && current.actual == null) {
      current.actual = total.currentEstimate;
    }
    byDate.set(point.date, current);
  }

  return [...byDate.values()]
    .filter(
      (point) =>
        point.day >= -DASHBOARD_HISTORY_WINDOW_DAYS &&
        point.day <= DASHBOARD_FORECAST_WINDOW_DAYS,
    )
    .sort((left, right) => left.day - right.day);
}
