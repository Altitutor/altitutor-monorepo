import type {
  PreparationEngineInput,
  PreparationVersions,
} from "@/features/preparation/model/types";
import type {
  StudyPlanTaskStatus,
  StudyPlanTimingEvidenceSession,
} from "@/features/study-plan/model/types";
import { addDays } from "@/features/study-plan/lib/dates";

export type PreparationForecastHistorySnapshot = {
  generatedAt: string;
  projectionSnapshot: unknown;
};

type TaskEvidence = {
  scheduledDate: string;
  status: StudyPlanTaskStatus;
  optional: boolean;
};

type SnapshotRecord = Record<string, unknown>;

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
  return {
    date: snapshotEvidence.generatedAt.slice(0, 10),
    currentEstimate: currentScore.currentEstimate,
    modelVersion: versions.trajectoryModel,
  };
}

export function derivePreparationForecastEvidence(input: {
  today: string;
  versions: PreparationVersions;
  activePlanSnapshot: PreparationForecastHistorySnapshot | null;
  historySnapshots: PreparationForecastHistorySnapshot[];
  activeGenerationTasks: TaskEvidence[];
  timingSessions: StudyPlanTimingEvidenceSession[];
  cognitiveSectionIds: Set<string>;
}): NonNullable<PreparationEngineInput["evidence"]["forecast"]> {
  const active = input.activePlanSnapshot;
  const activeSnapshot = active ? record(active.projectionSnapshot) : null;
  const compatibleActive =
    activeSnapshot && matchesVersions(activeSnapshot, input.versions)
      ? activeSnapshot
      : null;
  const dueCoreTasks = input.activeGenerationTasks.filter(
    (task) =>
      task.scheduledDate <= input.today &&
      !task.optional &&
      task.status !== "skipped",
  );
  const completedCoreTasks = dueCoreTasks.filter(
    (task) => task.status === "completed",
  ).length;
  const expectedAdherence = dueCoreTasks.length
    ? completedCoreTasks / dueCoreTasks.length
    : null;
  const adherenceUncertainty =
    expectedAdherence == null
      ? null
      : Math.max(
          0.08,
          Math.sqrt(
            (expectedAdherence * (1 - expectedAdherence) + 0.25) /
              (dueCoreTasks.length + 1),
          ),
        );
  const recentCutoff = addDays(input.today, -20);
  const recentCoreSectionEquivalents = input.timingSessions
    .filter(
      (session) =>
        session.completedAt.slice(0, 10) >= recentCutoff &&
        input.cognitiveSectionIds.has(session.sectionId),
    )
    .reduce((sum, session) => sum + session.sectionEquivalents, 0);

  return {
    previousSectionTargets: compatibleActive
      ? sectionTargets(compatibleActive)
      : undefined,
    previousSectionTargetsSetAt: compatibleActive
      ? active?.generatedAt ?? null
      : null,
    recentCoreSectionEquivalentsPerWeek:
      recentCoreSectionEquivalents > 0
        ? recentCoreSectionEquivalents / 3
        : null,
    expectedAdherence,
    adherenceUncertainty,
    history: input.historySnapshots
      .flatMap((snapshot) => {
        const point = historyPoint(snapshot, input.versions);
        return point ? [point] : [];
      })
      .sort((left, right) => left.date.localeCompare(right.date)),
  };
}
