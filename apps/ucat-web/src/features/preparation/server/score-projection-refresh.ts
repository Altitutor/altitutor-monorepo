import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  CURRENT_PREPARATION_VERSIONS,
  estimatePreparationCurrentScore,
  parseRepresentativeScoreEvidence,
  type PreparationEngineInput,
} from "@/features/preparation";
import { buildPreparationTrajectory } from "@/features/preparation/lib/trajectory";
import {
  derivePreparationForecastEvidence,
  mergeCurrentPreparationHistory,
  type PreparationForecastHistorySnapshot,
} from "@/features/preparation/lib/forecast-evidence";
import { persistPreparationProjectionSnapshot } from "@/features/preparation/server/preparation-snapshot";
import type {
  StudyPlanSection,
  StudyPlanTimingEvidenceSession,
} from "@/features/study-plan/model/types";
import { todayIso } from "@/features/study-plan/lib/dates";

type ScoreEvidenceRow = Parameters<typeof parseRepresentativeScoreEvidence>[0];

const SECTION_KEYS: Record<number, StudyPlanSection["key"]> = {
  1: "verbal_reasoning",
  2: "decision_making",
  3: "quantitative_reasoning",
  4: "situational_judgement",
};

const SECTION_SHORT_NAMES: Record<number, string> = {
  1: "VR",
  2: "DM",
  3: "QR",
  4: "SJT",
};

function requireAdmin() {
  if (!supabaseAdmin) throw new Error("Supabase admin client is unavailable.");
  return supabaseAdmin;
}

function timingSession(
  row: ScoreEvidenceRow,
): StudyPlanTimingEvidenceSession | null {
  const evidence = parseRepresentativeScoreEvidence(row);
  if (!evidence) return null;
  return {
    id: evidence.evidenceSessionId,
    sectionId: evidence.sectionId,
    source: evidence.source,
    completedAt: evidence.completedAt,
    prescribedPace: evidence.prescribedPace,
    observedPace: row.observed_pace,
    accuracy:
      evidence.marksAvailable > 0
        ? evidence.marksAwarded / evidence.marksAvailable
        : null,
    sectionEquivalents:
      evidence.sectionQuestionCount > 0
        ? evidence.questionCount / evidence.sectionQuestionCount
        : 0,
    breadth: evidence.breadth,
    categoryIds: evidence.categoryIds,
  };
}

/**
 * Refreshes only the persisted score estimate and trajectory. It deliberately
 * does not load or generate Study-plan tasks, catalogue practice inventory,
 * learning modules, or target/test-date overlays.
 */
export async function refreshStudentScoreProjection(
  studentId: string,
): Promise<void> {
  const admin = requireAdmin();
  const aggregateClient = admin as unknown as {
    rpc: (
      name: "get_student_ucat_score_projection_evidence",
      params: { p_student_id: string },
    ) => Promise<{
      data: ScoreEvidenceRow[] | null;
      error: { message: string } | null;
    }>;
  };
  const [studentResult, sectionsResult, evidenceResult, historyResult] =
    await Promise.all([
      admin
        .from("students")
        .select("timezone")
        .eq("id", studentId)
        .maybeSingle(),
      admin
        .from("ucat_sections")
        .select(
          "id, name, section_number, number_of_questions, time_per_question",
        )
        .order("section_number"),
      aggregateClient.rpc("get_student_ucat_score_projection_evidence", {
        p_student_id: studentId,
      }),
      admin
        .from("ucat_preparation_snapshots")
        .select("generated_at, snapshot_date, snapshot")
        .eq("student_id", studentId)
        .order("generated_at", { ascending: false })
        .limit(60),
    ]);

  if (studentResult.error) throw studentResult.error;
  if (!studentResult.data) throw new Error("No student profile found.");
  if (sectionsResult.error) throw sectionsResult.error;
  if (evidenceResult.error) throw new Error(evidenceResult.error.message);
  if (historyResult.error) throw historyResult.error;

  const sections: StudyPlanSection[] = (sectionsResult.data ?? []).flatMap(
    (section) => {
      const sectionNumber = section.section_number;
      const key = sectionNumber == null ? null : SECTION_KEYS[sectionNumber];
      return section.id && sectionNumber != null && key
        ? [
            {
              id: section.id,
              key,
              name: section.name ?? "Unknown",
              shortName:
                SECTION_SHORT_NAMES[sectionNumber] ?? section.name ?? "",
              sectionNumber,
              questionCount: section.number_of_questions ?? 0,
              timePerQuestionSeconds: section.time_per_question ?? 0,
            },
          ]
        : [];
    },
  );
  const evidenceRows = evidenceResult.data ?? [];
  const scoreEvidence = evidenceRows.flatMap((row) => {
    const evidence = parseRepresentativeScoreEvidence(row);
    return evidence ? [evidence] : [];
  });
  const timingSessions = evidenceRows.flatMap((row) => {
    const session = timingSession(row);
    return session ? [session] : [];
  });
  const historySnapshots: PreparationForecastHistorySnapshot[] = (
    historyResult.data ?? []
  ).flatMap((row) =>
    row.generated_at && row.snapshot
      ? [
          {
            generatedAt: row.generated_at,
            snapshotDate: row.snapshot_date ?? undefined,
            projectionSnapshot: row.snapshot,
          },
        ]
      : [],
  );
  const now = new Date();
  const today = todayIso(
    now,
    studentResult.data.timezone || "Australia/Adelaide",
  );
  const forecast = derivePreparationForecastEvidence({
    today,
    versions: CURRENT_PREPARATION_VERSIONS,
    activePlanSnapshot: null,
    historySnapshots,
    recentPlanTaskHistory: [],
    timingSessions,
    cognitiveSectionIds: new Set(
      sections
        .filter((section) => section.sectionNumber <= 3)
        .map((section) => section.id),
    ),
  });
  const scoreInput: Pick<
    PreparationEngineInput,
    "clock" | "versions" | "content" | "evidence"
  > = {
    clock: { now: now.toISOString(), today },
    versions: CURRENT_PREPARATION_VERSIONS,
    content: {
      sections,
      categories: [],
      learningModules: [],
      skillTrainers: [],
      benchmarkSets: [],
      benchmarkMocks: [],
    },
    evidence: {
      sectionSignals: [],
      scoreEvidence,
      completedMockCount: 0,
      forecast,
    },
  };
  const currentScore = estimatePreparationCurrentScore(scoreInput);
  const trajectory = buildPreparationTrajectory({
    today,
    modelVersion: CURRENT_PREPARATION_VERSIONS.trajectoryModel,
    currentScore,
    forecast,
  });
  const projection = {
    generatedAt: now.toISOString(),
    versions: CURRENT_PREPARATION_VERSIONS,
    currentScore,
    trajectory: {
      ...trajectory,
      history: mergeCurrentPreparationHistory(
        trajectory.history,
        currentScore,
        today,
        CURRENT_PREPARATION_VERSIONS.trajectoryModel,
      ),
    },
  };

  await persistPreparationProjectionSnapshot(studentId, today, projection);
}
