import { NextResponse } from "next/server";
import { scaleTo300_900 } from "@altitutor/ucat-marking";
import { getSupabaseServerClient } from "@/lib/supabase/server";
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
  ScoreProjectionResponse,
} from "@/features/score-projection/types/score-projection";

const HISTORY_LOOKBACK_DAYS = 84;
const HISTORY_STEP_DAYS = 7;

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

type SetAttemptRow = {
  attempted_at: string | null;
  completed_at: string | null;
  question_set_id: string | null;
  score_points: number | null;
  total_points: number | null;
  scaled_score: number | null;
  student_ucat_mock_attempt_id: string | null;
  was_timed: boolean | null;
  student_exam_speed: number | null;
};

type PracticeSessionRow = {
  completed_at: string | null;
  started_at: string | null;
  ucat_section_id: string | null;
  score_points: number | null;
  total_points: number | null;
};

type SetMetaRow = {
  id: string;
  sections: Array<{ section_number?: number }> | null;
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

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
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

  const [sectionsRes, setAttemptsRes, practiceRes, settingsRes] =
    await Promise.all([
      supabase
        .from("vstudent_ucat_sections")
        .select("id, name, section_number")
        .order("section_number"),
      supabase
        .from("vstudent_ucat_my_set_attempts")
        .select(
          "attempted_at, completed_at, question_set_id, score_points, total_points, scaled_score, student_ucat_mock_attempt_id, was_timed, student_exam_speed",
        )
        .not("completed_at", "is", null),
      supabase
        .from("vstudent_ucat_my_practice_sessions")
        .select(
          "started_at, completed_at, ucat_section_id, score_points, total_points",
        )
        .not("completed_at", "is", null),
      supabase.from("ucat_score_projection_settings").select("*"),
    ]);

  if (sectionsRes.error) {
    return NextResponse.json(
      { error: sectionsRes.error.message },
      { status: 500 },
    );
  }
  if (setAttemptsRes.error) {
    return NextResponse.json(
      { error: setAttemptsRes.error.message },
      { status: 500 },
    );
  }
  if (practiceRes.error) {
    return NextResponse.json(
      { error: practiceRes.error.message },
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

  const sectionByNumber = new Map<number, string>(
    sections.map((section) => [section.sectionNumber, section.id]),
  );
  const evidenceBySection = new Map<string, AttemptEvidence[]>(
    sections.map((section) => [section.id, [] as AttemptEvidence[]]),
  );

  const setRows = (setAttemptsRes.data ?? []) as SetAttemptRow[];
  const setIds = [
    ...new Set(
      setRows
        .map((row) => row.question_set_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const setMetaRes =
    setIds.length > 0
      ? await supabase
          .from("vstudent_ucat_question_sets")
          .select("id, sections")
          .in("id", setIds)
      : { data: [], error: null };

  if (setMetaRes.error) {
    return NextResponse.json(
      { error: setMetaRes.error.message },
      { status: 500 },
    );
  }

  const sectionBySetId = new Map<string, string>();
  for (const meta of (setMetaRes.data ?? []) as SetMetaRow[]) {
    const sectionNumber = Array.isArray(meta.sections)
      ? meta.sections[0]?.section_number
      : null;
    const sectionId =
      sectionNumber != null ? sectionByNumber.get(sectionNumber) : null;
    if (sectionId) sectionBySetId.set(meta.id, sectionId);
  }

  for (const row of setRows) {
    if (row.scaled_score == null || row.total_points == null) continue;
    const sectionId = row.question_set_id
      ? sectionBySetId.get(row.question_set_id)
      : null;
    if (!sectionId) continue;
    const completedAt = timestamp(row.completed_at ?? row.attempted_at);
    if (completedAt == null) continue;
    evidenceBySection.get(sectionId)?.push({
      source: row.student_ucat_mock_attempt_id ? "mock" : "set",
      score: row.scaled_score,
      scoredPoints: row.score_points ?? 0,
      totalPoints: row.total_points,
      timestamp: completedAt,
      wasTimed: row.was_timed ?? false,
      examSpeedRatio: row.student_exam_speed,
    });
  }

  const settingsBySection = new Map(
    ((settingsRes.data ?? []) as SettingsRow[])
      .filter((row) => row.section_id != null)
      .map((row) => [row.section_id!, row]),
  );

  for (const row of (practiceRes.data ?? []) as PracticeSessionRow[]) {
    if (
      !row.ucat_section_id ||
      row.score_points == null ||
      row.total_points == null
    ) {
      continue;
    }
    const settings = withDefaults(settingsBySection.get(row.ucat_section_id));
    if (row.total_points < settings.minPracticeScoredPoints) continue;
    const completedAt = timestamp(row.completed_at ?? row.started_at);
    if (completedAt == null) continue;
    evidenceBySection.get(row.ucat_section_id)?.push({
      source: "practice",
      score: scaleTo300_900(row.score_points, row.total_points),
      scoredPoints: row.score_points,
      totalPoints: row.total_points,
      timestamp: completedAt,
      wasTimed: false,
      examSpeedRatio: null,
    });
  }

  const generatedAt = new Date();
  const payload: ScoreProjectionResponse = {
    generatedAt: generatedAt.toISOString(),
    horizons: [...DEFAULT_HORIZONS],
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

  return NextResponse.json(payload);
}
