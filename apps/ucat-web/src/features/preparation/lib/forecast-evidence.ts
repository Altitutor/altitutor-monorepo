import type {
  PreparationCurrentScoreEstimate,
  PreparationEngineInput,
  PreparationTrajectoryHistoryPoint,
  PreparationVersions,
} from "@/features/preparation/model/types";
import type {
  StudyPlanTaskStatus,
  StudyPlanTimingEvidenceSession,
} from "@/features/study-plan/model/types";
import { addDays, daysBetween } from "@/features/study-plan/lib/dates";

export type PreparationForecastHistorySnapshot = {
  generatedAt: string;
  snapshotDate?: string;
  projectionSnapshot: unknown;
};

type TaskEvidence = {
  scheduledDate: string;
  status: StudyPlanTaskStatus;
  optional: boolean;
  generationId?: string;
  generationGeneratedAt?: string;
};

type SnapshotRecord = Record<string, unknown>;

const BEHAVIOR_LOOKBACK_WEEKS = 6;
const BEHAVIOR_HALF_LIFE_WEEKS = 2;
const PLAN_UPTAKE_PRIOR = 0.5;
const PLAN_UPTAKE_PRIOR_WEIGHT = 2;

function recencyWeight(week: number): number {
  return 2 ** (-week / BEHAVIOR_HALF_LIFE_WEEKS);
}

function recentBehaviorBySection(input: {
  today: string;
  sessions: StudyPlanTimingEvidenceSession[];
  cognitiveSectionIds: Set<string>;
}): Record<string, number> {
  const weightedWeeks = Array.from(
    { length: BEHAVIOR_LOOKBACK_WEEKS },
    (_, week) => recencyWeight(week),
  );
  const denominator = weightedWeeks.reduce((sum, weight) => sum + weight, 0);
  const totals = new Map<string, number>();
  for (const session of input.sessions) {
    if (!input.cognitiveSectionIds.has(session.sectionId)) continue;
    const ageDays = daysBetween(session.completedAt.slice(0, 10), input.today);
    if (ageDays < 0 || ageDays >= BEHAVIOR_LOOKBACK_WEEKS * 7) continue;
    const week = Math.floor(ageDays / 7);
    totals.set(
      session.sectionId,
      (totals.get(session.sectionId) ?? 0) +
        Math.max(0, session.sectionEquivalents) * weightedWeeks[week]!,
    );
  }
  return Object.fromEntries(
    [...totals.entries()].map(([sectionId, total]) => [
      sectionId,
      Math.round((total / denominator) * 100) / 100,
    ]),
  );
}

function planUptake(input: { today: string; tasks: TaskEvidence[] }): {
  expected: number;
  uncertainty: number;
} {
  const start = addDays(input.today, -(BEHAVIOR_LOOKBACK_WEEKS * 7 - 1));
  const latestGenerationByDate = new Map<string, string>();
  for (const task of input.tasks) {
    if (!task.generationGeneratedAt) continue;
    const current = latestGenerationByDate.get(task.scheduledDate);
    if (!current || task.generationGeneratedAt > current) {
      latestGenerationByDate.set(
        task.scheduledDate,
        task.generationGeneratedAt,
      );
    }
  }
  const dueByDate = Map.groupBy(
    input.tasks.filter(
      (task) =>
        task.scheduledDate >= start &&
        task.scheduledDate < input.today &&
        !task.optional &&
        (!task.generationGeneratedAt ||
          task.generationGeneratedAt ===
            latestGenerationByDate.get(task.scheduledDate)),
    ),
    (task) => task.scheduledDate,
  );
  let weightedCompletion = PLAN_UPTAKE_PRIOR * PLAN_UPTAKE_PRIOR_WEIGHT;
  let totalWeight = PLAN_UPTAKE_PRIOR_WEIGHT;
  for (const [date, tasks] of dueByDate) {
    const ageDays = daysBetween(date, input.today);
    const weight = recencyWeight(Math.floor(ageDays / 7));
    const completion =
      tasks.filter((task) => task.status === "completed").length / tasks.length;
    weightedCompletion += completion * weight;
    totalWeight += weight;
  }
  const expected = weightedCompletion / totalWeight;
  return {
    expected: Math.round(expected * 1000) / 1000,
    uncertainty: Math.max(
      0.08,
      Math.sqrt((expected * (1 - expected) + 0.25) / (totalWeight + 1)),
    ),
  };
}

function record(value: unknown): SnapshotRecord | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as SnapshotRecord)
    : null;
}

function snapshotVersions(snapshot: SnapshotRecord): SnapshotRecord | null {
  return record(snapshot.versions);
}

function matchesVersions(
  snapshot: SnapshotRecord,
  versions: PreparationVersions,
): boolean {
  const stored = snapshotVersions(snapshot);
  return (
    stored?.engine === versions.engine &&
    stored.policy === versions.policy &&
    stored.trajectoryModel === versions.trajectoryModel &&
    stored.scoreModel === versions.scoreModel
  );
}

function sectionTargets(snapshot: SnapshotRecord): Record<string, number> {
  const targets = record(snapshot.sectionTargets);
  if (!targets) return {};
  return Object.fromEntries(
    Object.entries(targets).flatMap(([sectionId, target]) =>
      typeof target === "number" ? [[sectionId, target]] : [],
    ),
  );
}

function historyPoint(
  snapshotEvidence: PreparationForecastHistorySnapshot,
  versions: PreparationVersions,
) {
  const snapshot = record(snapshotEvidence.projectionSnapshot);
  if (!snapshot || !matchesVersions(snapshot, versions)) return null;
  const currentScore = record(snapshot.currentScore);
  if (
    currentScore?.status !== "available" ||
    typeof currentScore.currentEstimate !== "number"
  ) {
    return null;
  }
  const sections = Array.isArray(currentScore.sections)
    ? Object.fromEntries(
        currentScore.sections.flatMap((value) => {
          const section = record(value);
          return typeof section?.sectionId === "string" &&
            typeof section.currentEstimate === "number"
            ? [
                [
                  section.sectionId,
                  {
                    currentEstimate: section.currentEstimate,
                    confidence:
                      section.confidence === "low" ||
                      section.confidence === "medium" ||
                      section.confidence === "high"
                        ? section.confidence
                        : null,
                    uncertainty:
                      typeof section.uncertainty === "number"
                        ? section.uncertainty
                        : null,
                    evidenceCount:
                      typeof section.evidenceCount === "number"
                        ? section.evidenceCount
                        : 0,
                  },
                ] as const,
              ]
            : [];
        }),
      )
    : {};
  const confidence: "low" | "medium" | "high" | null =
    currentScore.confidence === "low" ||
    currentScore.confidence === "medium" ||
    currentScore.confidence === "high"
      ? currentScore.confidence
      : null;
  return {
    date:
      snapshotEvidence.snapshotDate ??
      snapshotEvidence.generatedAt.slice(0, 10),
    currentEstimate: currentScore.currentEstimate,
    modelVersion: versions.trajectoryModel,
    confidence,
    uncertainty:
      typeof currentScore.uncertainty === "number"
        ? currentScore.uncertainty
        : null,
    effectiveEvidenceWeight: Object.values(sections).reduce(
      (sum, section) => sum + section.evidenceCount,
      0,
    ),
    sections,
  };
}

export function mergeCurrentPreparationHistory(
  history: PreparationTrajectoryHistoryPoint[],
  currentScore: Pick<
    PreparationCurrentScoreEstimate,
    "status" | "currentEstimate" | "confidence" | "uncertainty" | "sections"
  >,
  date: string,
  modelVersion: string,
): PreparationTrajectoryHistoryPoint[] {
  if (
    currentScore.status !== "available" ||
    currentScore.currentEstimate == null
  ) {
    return history;
  }
  const sections = Object.fromEntries(
    currentScore.sections.flatMap((section) =>
      section.currentEstimate == null
        ? []
        : [
            [
              section.sectionId,
              {
                currentEstimate: section.currentEstimate,
                confidence: section.confidence,
                uncertainty: section.uncertainty,
                evidenceCount: section.evidenceCount,
              },
            ] as const,
          ],
    ),
  );
  const current: PreparationTrajectoryHistoryPoint = {
    date,
    currentEstimate: currentScore.currentEstimate,
    modelVersion,
    confidence: currentScore.confidence,
    uncertainty: currentScore.uncertainty,
    effectiveEvidenceWeight: currentScore.sections.reduce(
      (sum, section) => sum + section.evidenceCount,
      0,
    ),
    sections,
  };
  return Array.from(
    [...history, current]
      .reduce(
        (points, point) => points.set(point.date, point),
        new Map<string, PreparationTrajectoryHistoryPoint>(),
      )
      .values(),
  ).sort((left, right) => left.date.localeCompare(right.date));
}

export function derivePreparationForecastEvidence(input: {
  today: string;
  versions: PreparationVersions;
  activePlanSnapshot: PreparationForecastHistorySnapshot | null;
  historySnapshots: PreparationForecastHistorySnapshot[];
  recentPlanTaskHistory: TaskEvidence[];
  timingSessions: StudyPlanTimingEvidenceSession[];
  cognitiveSectionIds: Set<string>;
}): NonNullable<PreparationEngineInput["evidence"]["forecast"]> {
  const active = input.activePlanSnapshot;
  const activeSnapshot = active ? record(active.projectionSnapshot) : null;
  const compatibleActive =
    activeSnapshot && matchesVersions(activeSnapshot, input.versions)
      ? activeSnapshot
      : null;
  const uptake = planUptake({
    today: input.today,
    tasks: input.recentPlanTaskHistory,
  });
  const recentBySection = recentBehaviorBySection({
    today: input.today,
    sessions: input.timingSessions,
    cognitiveSectionIds: input.cognitiveSectionIds,
  });
  const recentCoreSectionEquivalents = Object.values(recentBySection).reduce(
    (sum, value) => sum + value,
    0,
  );

  return {
    previousSectionTargets: compatibleActive
      ? sectionTargets(compatibleActive)
      : undefined,
    previousSectionTargetsSetAt: compatibleActive
      ? (active?.generatedAt ?? null)
      : null,
    recentCoreSectionEquivalentsPerWeek:
      recentCoreSectionEquivalents > 0
        ? Math.round(recentCoreSectionEquivalents * 100) / 100
        : null,
    recentCoreSectionEquivalentsPerWeekBySection: recentBySection,
    expectedPlanUptake: uptake.expected,
    planUptakeUncertainty: uptake.uncertainty,
    history: Array.from(
      input.historySnapshots
        .slice()
        .sort((left, right) =>
          left.generatedAt.localeCompare(right.generatedAt),
        )
        .reduce((points, snapshot) => {
          const point = historyPoint(snapshot, input.versions);
          if (point) points.set(point.date, point);
          return points;
        }, new Map<string, NonNullable<ReturnType<typeof historyPoint>>>())
        .values(),
    ),
  };
}
