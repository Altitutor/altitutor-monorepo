import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { MODEL_DEFAULTS } from "@/features/study-planner/lib/constants";
import { runKalmanFilter } from "@/features/study-planner/lib/kalman-filter";
import { fitCurve } from "@/features/study-planner/lib/learning-curve";
import { generateProjection } from "@/features/study-planner/lib/score-projection";
import {
  computeRNeeded,
  getTrajectoryStatus,
} from "@/features/study-planner/lib/study-plan-generator";
import type { StudyPlannerProjectionResponse } from "@/features/study-planner/types/study-planner";

type StudentSettingsRow = {
  id: string;
  ucat_test_date: string | null;
  ucat_target_score_s1: number | null;
  ucat_target_score_s2: number | null;
  ucat_target_score_s3: number | null;
};

type SectionRow = {
  id: string | null;
  name: string | null;
  section_number: number | null;
};

type SetAttemptRow = {
  attempted_at: string | null;
  completed_at: string | null;
  question_set_id: string | null;
  scaled_score: number | null;
  student_ucat_mock_attempt_id: string | null;
};

type SetMetaRow = {
  id: string;
  sections: Array<{ section_number?: number }> | null;
};

type QuestionAttemptRow = {
  attempted_at: string | null;
  ucat_section_id: string | null;
};

type ModelConfigRow = {
  section_id: string | null;
  k_prior: number | null;
  s_inf_uplift: number | null;
  r_noise: number | null;
  p0: number | null;
};

type PostgrestLikeError = {
  message?: string;
  code?: string;
};

function isMissingStudyPlannerColumnError(error: PostgrestLikeError): boolean {
  const message = error.message ?? "";
  return (
    message.includes("Could not find the 'ucat_target_score_s1' column") ||
    message.includes("Could not find the 'ucat_test_date' column")
  );
}

function isMissingModelConfigTableError(error: PostgrestLikeError): boolean {
  const message = error.message ?? "";
  return (
    message.includes("relation \"public.ucat_model_config\" does not exist") ||
    message.includes("Could not find the table 'ucat_model_config'")
  );
}

function asIsoDate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toNumberOrNull(value: number | null | undefined): number | null {
  return value == null ? null : Number(value);
}

function getTargetScoreBySection(
  sectionNumber: number,
  student: StudentSettingsRow,
): number | null {
  if (sectionNumber === 1) return toNumberOrNull(student.ucat_target_score_s1);
  if (sectionNumber === 2) return toNumberOrNull(student.ucat_target_score_s2);
  if (sectionNumber === 3) return toNumberOrNull(student.ucat_target_score_s3);
  return null;
}

function toConfidence(observationCount: number): "low" | "medium" | "high" {
  if (observationCount >= MODEL_DEFAULTS.MIN_OBS_FOR_STABLE_TRAJECTORY) {
    return "high";
  }
  if (observationCount >= MODEL_DEFAULTS.MIN_OBS_FOR_REFIT) {
    return "medium";
  }
  return "low";
}

async function resolveStudent(userId: string): Promise<StudentSettingsRow | null> {
  if (!supabaseAdmin) return null;
  const { data: idData, error: idError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (idError || !idData?.id) return null;

  const { data, error } = await supabaseAdmin
    .from("students")
    .select(
      "id, ucat_test_date, ucat_target_score_s1, ucat_target_score_s2, ucat_target_score_s3",
    )
    .eq("id", idData.id)
    .maybeSingle();
  if (error) {
    if (isMissingStudyPlannerColumnError(error)) {
      return {
        id: idData.id,
        ucat_test_date: null,
        ucat_target_score_s1: null,
        ucat_target_score_s2: null,
        ucat_target_score_s3: null,
      };
    }
    return null;
  }
  if (!data) return null;
  return data as StudentSettingsRow;
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

  const student = await resolveStudent(user.id);
  if (!student) {
    return NextResponse.json<StudyPlannerProjectionResponse>({
      sections: [],
      testDate: null,
    });
  }

  const [sectionsRes, setAttemptsRes, questionAttemptsRes] = await Promise.all([
    supabase
      .from("vstudent_ucat_sections")
      .select("id, name, section_number")
      .order("section_number"),
    supabase
      .from("vstudent_ucat_my_set_attempts")
      .select(
        "attempted_at, completed_at, question_set_id, scaled_score, student_ucat_mock_attempt_id",
      )
      .not("completed_at", "is", null),
    supabase
      .from("vstudent_ucat_my_question_attempts")
      .select("attempted_at, ucat_section_id")
      .eq("is_submitted", true),
  ]);

  if (sectionsRes.error) {
    return NextResponse.json({ error: sectionsRes.error.message }, { status: 500 });
  }
  if (setAttemptsRes.error) {
    return NextResponse.json(
      { error: setAttemptsRes.error.message },
      { status: 500 },
    );
  }
  if (questionAttemptsRes.error) {
    return NextResponse.json(
      { error: questionAttemptsRes.error.message },
      { status: 500 },
    );
  }

  const sections = (sectionsRes.data ?? [])
    .filter(
      (s): s is SectionRow =>
        s.id != null &&
        s.section_number != null &&
        s.section_number >= 1 &&
        s.section_number <= 3,
    )
    .sort((a, b) => (a.section_number ?? 0) - (b.section_number ?? 0));

  const questionSetIds = [
    ...new Set(
      ((setAttemptsRes.data ?? []) as SetAttemptRow[])
        .map((a) => a.question_set_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const setMetaRes =
    questionSetIds.length > 0
      ? await supabase
          .from("vstudent_ucat_question_sets")
          .select("id, sections")
          .in("id", questionSetIds)
      : { data: [], error: null };

  if (setMetaRes.error) {
    return NextResponse.json({ error: setMetaRes.error.message }, { status: 500 });
  }

  const sectionByNumber = new Map<number, string>(
    sections.map((s) => [s.section_number!, s.id!]),
  );
  const setSectionIdBySetId = new Map<string, string>();
  for (const meta of (setMetaRes.data ?? []) as SetMetaRow[]) {
    const firstSection = Array.isArray(meta.sections) ? meta.sections[0] : null;
    const sectionNum = firstSection?.section_number;
    if (sectionNum == null) continue;
    const sectionId = sectionByNumber.get(sectionNum);
    if (!sectionId) continue;
    setSectionIdBySetId.set(meta.id, sectionId);
  }

  const modelConfigRes = await supabase
    .from("ucat_model_config")
    .select("section_id, k_prior, s_inf_uplift, r_noise, p0");

  if (modelConfigRes.error) {
    if (!isMissingModelConfigTableError(modelConfigRes.error)) {
      return NextResponse.json(
        { error: modelConfigRes.error.message },
        { status: 500 },
      );
    }
  }

  const configBySectionId = new Map(
    ((modelConfigRes.data ?? []) as ModelConfigRow[])
      .filter((row) => row.section_id != null)
      .map((row) => [row.section_id!, row]),
  );

  const questionsBySection = new Map<string, number[]>();
  for (const section of sections) {
    questionsBySection.set(section.id!, []);
  }
  for (const qa of (questionAttemptsRes.data ?? []) as QuestionAttemptRow[]) {
    if (!qa.ucat_section_id || !qa.attempted_at) continue;
    const ts = new Date(qa.attempted_at).getTime();
    if (!Number.isFinite(ts)) continue;
    const existing = questionsBySection.get(qa.ucat_section_id);
    if (!existing) continue;
    existing.push(ts);
  }
  for (const arr of questionsBySection.values()) {
    arr.sort((a, b) => a - b);
  }

  const setObservationsBySection = new Map<
    string,
    Array<{ timestamp: number; score: number }>
  >();
  for (const section of sections) {
    setObservationsBySection.set(section.id!, []);
  }

  for (const attempt of (setAttemptsRes.data ?? []) as SetAttemptRow[]) {
    if (attempt.scaled_score == null || !attempt.question_set_id) continue;
    if (attempt.student_ucat_mock_attempt_id) continue;
    const sectionId = setSectionIdBySetId.get(attempt.question_set_id);
    if (!sectionId) continue;
    const timeSource = attempt.completed_at ?? attempt.attempted_at;
    if (!timeSource) continue;
    const timestamp = new Date(timeSource).getTime();
    if (!Number.isFinite(timestamp)) continue;

    const list = setObservationsBySection.get(sectionId);
    if (!list) continue;
    list.push({
      timestamp,
      score: clamp(
        attempt.scaled_score,
        MODEL_DEFAULTS.SCORE_MIN,
        MODEL_DEFAULTS.SCORE_MAX,
      ),
    });
  }
  for (const arr of setObservationsBySection.values()) {
    arr.sort((a, b) => a.timestamp - b.timestamp);
  }

  const todayIso = asIsoDate(new Date().toISOString());
  const testDateIso = student.ucat_test_date;
  const testDate = testDateIso ? new Date(`${testDateIso}T00:00:00`) : null;
  const daysRemaining =
    testDate && todayIso
      ? Math.max(
          0,
          Math.round(
            (new Date(`${testDateIso}T00:00:00`).getTime() -
              new Date(`${todayIso}T00:00:00`).getTime()) /
              (24 * 60 * 60 * 1000),
          ),
        )
      : null;

  const payload: StudyPlannerProjectionResponse = {
    sections: [],
    testDate: testDateIso ?? null,
  };

  for (const section of sections) {
    const sectionId = section.id!;
    const sectionName = section.name ?? "Unknown";
    const sectionNumber = section.section_number!;
    const observations = setObservationsBySection.get(sectionId) ?? [];
    const observationCount = observations.length;
    const questionTimes = questionsBySection.get(sectionId) ?? [];
    const questionsCumulative = questionTimes.length;

    const config = configBySectionId.get(sectionId);
    const kPrior = config?.k_prior ?? 0.000136;
    const sInfUplift = config?.s_inf_uplift ?? 130;
    const p0 = config?.p0 ?? 2500;
    const rNoise = config?.r_noise ?? 1600;

    const s0 =
      observationCount > 0 ? observations[0].score : MODEL_DEFAULTS.SCORE_MIN;
    const kalman = runKalmanFilter(
      observations.map((obs) => ({ score: obs.score })),
      p0,
      rNoise,
      s0,
    );

    const curveObservations = observations.map((obs) => {
      let count = 0;
      for (const ts of questionTimes) {
        if (ts <= obs.timestamp) count += 1;
        else break;
      }
      return { q: count, score: obs.score };
    });

    const fitted =
      observationCount >= MODEL_DEFAULTS.MIN_OBS_FOR_REFIT
        ? fitCurve(curveObservations, s0, kPrior, sInfUplift)
        : {
            sInf: clamp(s0 + sInfUplift, s0 + 10, MODEL_DEFAULTS.SCORE_MAX),
            k: Math.max(kPrior, 1e-7),
          };

    const warnings: Array<
      "low_data" | "ceiling_limited" | "high_required_pace"
    > = [];
    if (observationCount < MODEL_DEFAULTS.MIN_OBS_FOR_REFIT) {
      warnings.push("low_data");
    }

    const targetScore = getTargetScoreBySection(sectionNumber, student);
    const projection =
      testDate && daysRemaining != null
        ? generateProjection({
            state: {
              s0,
              sInf: fitted.sInf,
              k: fitted.k,
              sHat: kalman.sHat,
              p: kalman.p,
              questionsCumulative,
            },
            testDate,
            questionsPerDay: MODEL_DEFAULTS.ASSUMED_DAILY_QUESTIONS,
          })
        : [];

    const sectionResult: StudyPlannerProjectionResponse["sections"][number] = {
      sectionId,
      sectionName,
      sectionNumber,
      sHat: kalman.sHat,
      uncertainty: Math.sqrt(Math.max(kalman.p, 0)),
      sInf: fitted.sInf,
      observationCount,
      isPriorPhase: observationCount < MODEL_DEFAULTS.MIN_OBS_FOR_REFIT,
      confidence: toConfidence(observationCount),
      warnings,
      projection,
    };

    if (
      targetScore != null &&
      testDate != null &&
      daysRemaining != null &&
      daysRemaining > 0
    ) {
      const needed = computeRNeeded({
        targetScore,
        sHat: kalman.sHat,
        sInf: fitted.sInf,
        k: fitted.k,
        qCumulative: questionsCumulative,
        daysRemaining,
      });
      const projectionWithNeeded = generateProjection({
        state: {
          s0,
          sInf: fitted.sInf,
          k: fitted.k,
          sHat: kalman.sHat,
          p: kalman.p,
          questionsCumulative,
        },
        testDate,
        questionsPerDay: Number.isFinite(needed.rNeeded)
          ? needed.rNeeded
          : MODEL_DEFAULTS.ASSUMED_DAILY_QUESTIONS,
      });
      sectionResult.projection = projectionWithNeeded;

      const projectedAtTestDate =
        projectionWithNeeded[projectionWithNeeded.length - 1]?.realistic ??
        kalman.sHat;
      const trajectoryStatus = getTrajectoryStatus(projectedAtTestDate, targetScore);

      if (needed.ceilingWarning) warnings.push("ceiling_limited");
      if (needed.paceWarning) warnings.push("high_required_pace");

      sectionResult.target = {
        score: targetScore,
        rNeeded: needed.rNeeded,
        ceilingWarning: needed.ceilingWarning,
        paceWarning: needed.paceWarning,
        trajectoryStatus,
      };
    }

    payload.sections.push(sectionResult);
  }

  return NextResponse.json(payload);
}
