import { NextResponse } from "next/server";
import {
  estimateUcatSectionScore,
  resolveUcatScoringSection,
} from "@altitutor/ucat-marking";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  DEFAULT_HORIZONS,
  defaultSettings,
  estimateSectionScore,
  generateTrajectory,
  resolveEffectivePracticePerWeek,
  type AttemptEvidence,
  type ScoreProjectionSettings,
} from "@/features/score-projection/lib/model";
import type {
  HistoricalProjectionPoint,
  ProjectionConfidence,
  ScoreProjectionResponse,
  ScoreProjectionSnapshot,
} from "@/features/score-projection/types/score-projection";
import { deriveTotalScoreProjection } from "@/features/score-projection/lib/total-projection";

const HISTORY_LOOKBACK_DAYS = 84;
const HISTORY_STEP_DAYS = 7;
const SNAPSHOT_LOOKBACK_DAYS = 365;

type SectionRow = {
  id: string | null;
  name: string | null;
  section_number: number | null;
};

type ResolvedSection = {
  id: string;
  name: string;
  sectionNumber: number;
};

type ProjectionEvidenceRow = {
  source: "set" | "mock" | "practice";
  section_id: string | null;
  completed_at: string | null;
  score_points: number | null;
  total_points: number | null;
  was_timed: boolean | null;
  student_exam_speed: number | null;
};

type SettingsRow = {
  section_id: string | null;
  mock_source_weight: number | null;
  set_source_weight: number | null;
  practice_source_weight: number | null;
  timed_weight: number | null;
  slow_timed_weight: number | null;
  untimed_weight: number | null;
  recency_half_life_days: number | null;
  min_practice_scored_points: number | null;
  min_prediction_evidence_weight: number | null;
  default_effective_questions_per_week: number | null;
  recent_activity_lookback_days: number | null;
  effective_practice_daily_cap: number | null;
  trajectory_horizon_days: number | null;
  trajectory_step_days: number | null;
  pessimistic_base_gain: number | null;
  realistic_base_gain: number | null;
  optimistic_base_gain: number | null;
  pessimistic_room_fraction: number | null;
  realistic_room_fraction: number | null;
  optimistic_room_fraction: number | null;
  pessimistic_low_score_boost: number | null;
  realistic_low_score_boost: number | null;
  optimistic_low_score_boost: number | null;
  pessimistic_effort_half_saturation: number | null;
  realistic_effort_half_saturation: number | null;
  optimistic_effort_half_saturation: number | null;
};

type SnapshotRow = {
  student_id: string;
  snapshot_date: string;
  current_estimate: number;
  confidence: ProjectionConfidence;
  uncertainty: number;
  effective_evidence_weight: number;
  section_estimates: unknown;
  generated_at: string;
};

type SnapshotWrite = SnapshotRow;

type SnapshotStore = {
  from: (relation: "ucat_score_projection_snapshots") => {
    select: (columns: string) => {
      eq: (
        column: "student_id",
        value: string,
      ) => {
        gte: (
          column: "snapshot_date",
          value: string,
        ) => {
          order: (
            column: "snapshot_date",
            options: { ascending: boolean },
          ) => Promise<{ data: SnapshotRow[] | null; error: Error | null }>;
        };
      };
    };
    upsert: (
      row: SnapshotWrite,
      options: { onConflict: "student_id,snapshot_date" },
    ) => Promise<{ error: Error | null }>;
  };
};

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function readSectionEstimates(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([sectionId, estimate]) =>
      typeof estimate === "number" ? [[sectionId, estimate]] : [],
    ),
  );
}

function toSnapshot(row: SnapshotRow): ScoreProjectionSnapshot {
  return {
    date: row.snapshot_date,
    currentEstimate: row.current_estimate,
    confidence: row.confidence,
    uncertainty: row.uncertainty,
    effectiveEvidenceWeight: row.effective_evidence_weight,
    sectionEstimates: readSectionEstimates(row.section_estimates),
  };
}

function snapshotsDiffer(left: SnapshotRow | undefined, right: SnapshotWrite) {
  if (!left) return true;
  return (
    left.current_estimate !== right.current_estimate ||
    left.confidence !== right.confidence ||
    left.uncertainty !== right.uncertainty ||
    left.effective_evidence_weight !== right.effective_evidence_weight ||
    JSON.stringify(readSectionEstimates(left.section_estimates)) !==
      JSON.stringify(right.section_estimates)
  );
}

async function captureDailySnapshot(
  userId: string,
  payload: ScoreProjectionResponse,
  generatedAt: Date,
): Promise<ScoreProjectionSnapshot[]> {
  if (!supabaseAdmin) return [];

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, timezone")
    .eq("user_id", userId)
    .maybeSingle();
  if (studentError || !student) {
    console.warn(
      "[score-projection] Snapshot student lookup failed",
      studentError,
    );
    return [];
  }

  const snapshotStore = supabaseAdmin as unknown as SnapshotStore;
  const lookback = new Date(generatedAt);
  lookback.setUTCDate(lookback.getUTCDate() - SNAPSHOT_LOOKBACK_DAYS);
  const { data, error } = await snapshotStore
    .from("ucat_score_projection_snapshots")
    .select(
      "student_id, snapshot_date, current_estimate, confidence, uncertainty, effective_evidence_weight, section_estimates, generated_at",
    )
    .eq("student_id", student.id)
    .gte("snapshot_date", isoDate(lookback))
    .order("snapshot_date", { ascending: true });
  if (error) {
    // The dashboard still works during a migration rollout; it simply starts
    // building trusted history once the snapshot table is available.
    console.warn("[score-projection] Snapshot history unavailable", error);
    return [];
  }

  const rows = data ?? [];
  const total = deriveTotalScoreProjection(payload.sections);
  if (
    total.currentEstimate == null ||
    total.confidence == null ||
    total.uncertainty == null
  ) {
    return rows.map(toSnapshot);
  }

  const snapshotDate = dateInTimeZone(
    generatedAt,
    student.timezone ?? "Australia/Adelaide",
  );
  const sectionEstimates = Object.fromEntries(
    payload.sections.flatMap((section) =>
      section.sectionNumber <= 3 && section.currentEstimate != null
        ? [[section.sectionId, section.currentEstimate]]
        : [],
    ),
  );
  const nextRow: SnapshotWrite = {
    student_id: student.id,
    snapshot_date: snapshotDate,
    current_estimate: total.currentEstimate,
    confidence: total.confidence,
    uncertainty: total.uncertainty,
    effective_evidence_weight:
      Math.round(total.effectiveEvidenceWeight * 100) / 100,
    section_estimates: sectionEstimates,
    generated_at: payload.generatedAt,
  };
  const currentRow = rows.find((row) => row.snapshot_date === snapshotDate);

  if (snapshotsDiffer(currentRow, nextRow)) {
    const { error: writeError } = await snapshotStore
      .from("ucat_score_projection_snapshots")
      .upsert(nextRow, { onConflict: "student_id,snapshot_date" });
    if (writeError) {
      console.warn("[score-projection] Snapshot write failed", writeError);
      return rows.map(toSnapshot);
    }
  }

  return [
    ...rows.filter((row) => row.snapshot_date !== snapshotDate).map(toSnapshot),
    toSnapshot(nextRow),
  ].sort((left, right) => left.date.localeCompare(right.date));
}

function historicalCheckpoints(generatedAt: Date): Date[] {
  const checkpoints: Date[] = [];
  for (
    let dayOffset = HISTORY_LOOKBACK_DAYS;
    dayOffset >= 0;
    dayOffset -= HISTORY_STEP_DAYS
  ) {
    const checkpoint = new Date(generatedAt);
    checkpoint.setDate(checkpoint.getDate() - dayOffset);
    checkpoints.push(checkpoint);
  }
  return checkpoints;
}

function buildHistoricalProjection(
  evidence: AttemptEvidence[],
  settings: ScoreProjectionSettings,
  generatedAt: Date,
): HistoricalProjectionPoint[] {
  return historicalCheckpoints(generatedAt).flatMap((checkpoint) => {
    const checkpointMs = checkpoint.getTime();
    const estimate = estimateSectionScore(
      evidence.filter((item) => item.timestamp <= checkpointMs),
      settings,
      checkpointMs,
    );

    if (estimate.currentEstimate == null) return [];
    return [
      {
        date: isoDate(checkpoint),
        value: estimate.currentEstimate,
        confidence: estimate.confidence,
        uncertainty: estimate.uncertainty,
        effectiveEvidenceWeight: estimate.effectiveEvidenceWeight,
      },
    ];
  });
}

function withDefaults(row: SettingsRow | undefined): ScoreProjectionSettings {
  const defaults = defaultSettings();
  if (!row) return defaults;
  return {
    mockSourceWeight: row.mock_source_weight ?? defaults.mockSourceWeight,
    setSourceWeight: row.set_source_weight ?? defaults.setSourceWeight,
    practiceSourceWeight:
      row.practice_source_weight ?? defaults.practiceSourceWeight,
    timedWeight: row.timed_weight ?? defaults.timedWeight,
    slowTimedWeight: row.slow_timed_weight ?? defaults.slowTimedWeight,
    untimedWeight: row.untimed_weight ?? defaults.untimedWeight,
    recencyHalfLifeDays:
      row.recency_half_life_days ?? defaults.recencyHalfLifeDays,
    minPracticeScoredPoints:
      row.min_practice_scored_points ?? defaults.minPracticeScoredPoints,
    minPredictionEvidenceWeight:
      row.min_prediction_evidence_weight ??
      defaults.minPredictionEvidenceWeight,
    defaultEffectiveQuestionsPerWeek:
      row.default_effective_questions_per_week ??
      defaults.defaultEffectiveQuestionsPerWeek,
    recentActivityLookbackDays:
      row.recent_activity_lookback_days ?? defaults.recentActivityLookbackDays,
    effectivePracticeDailyCap:
      row.effective_practice_daily_cap ?? defaults.effectivePracticeDailyCap,
    trajectoryHorizonDays:
      row.trajectory_horizon_days ?? defaults.trajectoryHorizonDays,
    trajectoryStepDays: row.trajectory_step_days ?? defaults.trajectoryStepDays,
    pessimisticBaseGain:
      row.pessimistic_base_gain ?? defaults.pessimisticBaseGain,
    realisticBaseGain: row.realistic_base_gain ?? defaults.realisticBaseGain,
    optimisticBaseGain: row.optimistic_base_gain ?? defaults.optimisticBaseGain,
    pessimisticRoomFraction:
      row.pessimistic_room_fraction ?? defaults.pessimisticRoomFraction,
    realisticRoomFraction:
      row.realistic_room_fraction ?? defaults.realisticRoomFraction,
    optimisticRoomFraction:
      row.optimistic_room_fraction ?? defaults.optimisticRoomFraction,
    pessimisticLowScoreBoost:
      row.pessimistic_low_score_boost ?? defaults.pessimisticLowScoreBoost,
    realisticLowScoreBoost:
      row.realistic_low_score_boost ?? defaults.realisticLowScoreBoost,
    optimisticLowScoreBoost:
      row.optimistic_low_score_boost ?? defaults.optimisticLowScoreBoost,
    pessimisticEffortHalfSaturation:
      row.pessimistic_effort_half_saturation ??
      defaults.pessimisticEffortHalfSaturation,
    realisticEffortHalfSaturation:
      row.realistic_effort_half_saturation ??
      defaults.realisticEffortHalfSaturation,
    optimisticEffortHalfSaturation:
      row.optimistic_effort_half_saturation ??
      defaults.optimisticEffortHalfSaturation,
  };
}

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [sectionsRes, evidenceRes, settingsRes] = await Promise.all([
    supabase
      .from("vstudent_ucat_sections")
      .select("id, name, section_number")
      .order("section_number"),
    (
      supabase as unknown as {
        from: (relation: string) => {
          select: (columns: string) => Promise<{
            data: ProjectionEvidenceRow[] | null;
            error: Error | null;
          }>;
        };
      }
    )
      .from("vstudent_ucat_score_projection_evidence")
      .select(
        "source, section_id, completed_at, score_points, total_points, was_timed, student_exam_speed",
      ),
    supabase.from("vstudent_ucat_score_projection_settings").select("*"),
  ]);

  if (sectionsRes.error) {
    return NextResponse.json(
      { error: sectionsRes.error.message },
      { status: 500 },
    );
  }
  if (evidenceRes.error) {
    return NextResponse.json(
      { error: evidenceRes.error.message },
      { status: 500 },
    );
  }
  if (settingsRes.error) {
    return NextResponse.json(
      { error: settingsRes.error.message },
      { status: 500 },
    );
  }

  const sections: ResolvedSection[] = ((sectionsRes.data ?? []) as SectionRow[])
    .flatMap((section) => {
      if (
        !section.id ||
        !section.name ||
        section.section_number == null ||
        section.section_number < 1 ||
        section.section_number > 4
      ) {
        return [];
      }
      return [
        {
          id: section.id,
          name: section.name,
          sectionNumber: section.section_number,
        },
      ];
    })
    .sort((a, b) => a.sectionNumber - b.sectionNumber);

  const evidenceBySection = new Map<string, AttemptEvidence[]>(
    sections.map((section) => [section.id, [] as AttemptEvidence[]]),
  );
  const scoringSectionById = new Map(
    sections.flatMap((section) => {
      const scoringSection = resolveUcatScoringSection(section.sectionNumber);
      return scoringSection ? [[section.id, scoringSection] as const] : [];
    }),
  );

  const settingsBySection = new Map(
    ((settingsRes.data ?? []) as SettingsRow[])
      .filter((row) => row.section_id != null)
      .map((row) => [row.section_id!, row]),
  );

  for (const row of evidenceRes.data ?? []) {
    if (!row.section_id || row.score_points == null || row.total_points == null)
      continue;
    const settings = withDefaults(settingsBySection.get(row.section_id));
    if (
      row.source === "practice" &&
      row.total_points < settings.minPracticeScoredPoints
    )
      continue;
    const completedAt = timestamp(row.completed_at);
    if (completedAt == null) continue;
    const scoringSection = scoringSectionById.get(row.section_id);
    if (!scoringSection) continue;
    evidenceBySection.get(row.section_id)?.push({
      source: row.source,
      score: estimateUcatSectionScore({
        section: scoringSection,
        rawScore: row.score_points,
        maxRawScore: row.total_points,
      }).scaledScore,
      scoredPoints: row.score_points,
      totalPoints: row.total_points,
      timestamp: completedAt,
      wasTimed: row.was_timed ?? false,
      examSpeedRatio: row.student_exam_speed,
    });
  }

  const generatedAt = new Date();
  const payload: ScoreProjectionResponse = {
    generatedAt: generatedAt.toISOString(),
    horizons: [...DEFAULT_HORIZONS],
    snapshots: [],
    sections: sections.map((section) => {
      const settings = withDefaults(settingsBySection.get(section.id));
      const evidence = evidenceBySection.get(section.id) ?? [];
      const estimate = estimateSectionScore(
        evidence,
        settings,
        generatedAt.getTime(),
      );
      const effectivePractice = estimate.weightedEvidence.length
        ? resolveEffectivePracticePerWeek(
            estimate.weightedEvidence,
            settings,
            generatedAt.getTime(),
          )
        : {
            pace: settings.defaultEffectiveQuestionsPerWeek,
            source: "default" as const,
          };
      const trajectory =
        estimate.currentEstimate == null
          ? { projection: [], horizons: [] }
          : generateTrajectory({
              currentEstimate: estimate.currentEstimate,
              effectivePracticePerWeek: effectivePractice.pace,
              settings,
              now: generatedAt,
              horizons: DEFAULT_HORIZONS,
            });

      return {
        sectionId: section.id,
        sectionName: section.name,
        sectionNumber: section.sectionNumber,
        currentEstimate: estimate.currentEstimate,
        confidence: estimate.confidence,
        uncertainty: estimate.uncertainty,
        effectiveEvidenceWeight: estimate.effectiveEvidenceWeight,
        evidenceCount: estimate.evidenceCount,
        paceSource: effectivePractice.source,
        effectivePracticePerWeek: Math.round(effectivePractice.pace),
        history: buildHistoricalProjection(evidence, settings, generatedAt),
        projection: trajectory.projection,
        horizons: trajectory.horizons,
      };
    }),
  };

  payload.snapshots = await captureDailySnapshot(user.id, payload, generatedAt);

  return NextResponse.json(payload);
}
