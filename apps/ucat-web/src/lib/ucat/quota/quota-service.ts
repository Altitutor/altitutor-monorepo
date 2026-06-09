import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { isUcatOnlineTier } from "@altitutor/shared";
import type {
  UcatOnlineTier,
  UcatQuotaArea,
  UcatQuotaAreaUsage,
  UcatQuotaUsageResponse,
  QuotaExceededPayload,
} from "@/features/ucat-access/types/quota";
import { UCAT_QUOTA_AREA_LABELS } from "@/features/ucat-access/types/quota";
import { getQuotaPeriodStart } from "@/lib/ucat/quota/period";
import {
  getAreaConfig,
  mapQuotaConfigRow,
  type UcatFreeQuotaConfig,
} from "@/lib/ucat/quota/config";

type AdminClient = SupabaseClient<Database>;

export type StudentQuotaContext = {
  studentId: string;
  timezone: string;
  onlineTier: UcatOnlineTier;
  isQuotaExempt: boolean;
  unlimitedTrialEligible: boolean;
  onboardingCompleted: boolean;
};

async function loadQuotaConfig(
  supabase: AdminClient,
): Promise<UcatFreeQuotaConfig> {
  const { data } = await supabase
    .from("ucat_subscription_config")
    .select(
      "free_practice_limit, free_practice_period, free_sets_limit, free_sets_period, free_mocks_limit, free_mocks_period, free_learn_limit, free_learn_period, free_skill_trainer_limit, free_skill_trainer_period",
    )
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return mapQuotaConfigRow(data);
}

export async function resolveStudentQuotaContext(
  supabase: AdminClient,
  studentId: string,
): Promise<StudentQuotaContext | null> {
  const [
    { data: student, error: studentError },
    { data: onlineTierRaw, error: tierError },
    { data: isQuotaExempt, error: exemptError },
  ] = await Promise.all([
    supabase
      .from("students")
      .select(
        "timezone, ucat_onboarding_completed_at, ucat_unlimited_trial_consumed_at",
      )
      .eq("id", studentId)
      .maybeSingle(),
    supabase.rpc("get_student_ucat_online_tier", { p_student_id: studentId }),
    supabase.rpc("is_ucat_online_quota_exempt", { p_student_id: studentId }),
  ]);

  if (studentError || tierError || exemptError || !student) return null;
  if (!isUcatOnlineTier(onlineTierRaw)) return null;

  return {
    studentId,
    timezone: student.timezone ?? "Australia/Adelaide",
    onlineTier: onlineTierRaw,
    isQuotaExempt: Boolean(isQuotaExempt),
    unlimitedTrialEligible: student.ucat_unlimited_trial_consumed_at == null,
    onboardingCompleted: student.ucat_onboarding_completed_at != null,
  };
}

export async function countQuotaUsage(
  supabase: AdminClient,
  ctx: StudentQuotaContext,
  area: UcatQuotaArea,
  config: UcatFreeQuotaConfig,
): Promise<number> {
  const { limit, period } = getAreaConfig(config, area);
  if (limit <= 0) return 0;

  const periodStart = getQuotaPeriodStart(period, ctx.timezone).toISOString();

  switch (area) {
    case "practice":
      return countPracticeUsage(supabase, ctx.studentId, periodStart);
    case "sets":
      return countStandaloneSetStarts(supabase, ctx.studentId, periodStart);
    case "mocks":
      return countMockStarts(supabase, ctx.studentId, periodStart);
    case "learn":
      return countLearnStarts(supabase, ctx.studentId, periodStart);
    case "skill_trainer":
      return countSkillTrainerStarts(supabase, ctx.studentId, periodStart);
  }
}

async function countLearnStarts(
  supabase: AdminClient,
  studentId: string,
  periodStart: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("ucat_student_learning_module_progress")
    .select("id, ucat_learning_modules!inner(kind)", { count: "exact", head: true })
    .eq("student_id", studentId)
    .eq("ucat_learning_modules.kind", "lesson")
    .gte("started_at", periodStart);

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return 0;
    }
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function countSkillTrainerStarts(
  supabase: AdminClient,
  studentId: string,
  periodStart: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("student_skill_trainer_attempts")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .is("learning_module_block_id", null)
    .gte("started_at", periodStart);

  if (error) {
    // Skill trainer schema may not be deployed yet; do not fail other quota areas.
    if (error.code === "42P01" || error.code === "PGRST205") {
      return 0;
    }
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function countPracticeUsage(
  supabase: AdminClient,
  studentId: string,
  periodStart: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("student_question_attempts")
    .select("question_id")
    .eq("student_id", studentId)
    .not("student_practice_session_id", "is", null)
    .is("student_question_set_attempt_id", null)
    .or("question_answer_option_id.not.is.null,answer_snapshot.not.is.null")
    .gte("attempted_at", periodStart);

  if (error) throw new Error(error.message);

  const unique = new Set((data ?? []).map((r) => r.question_id));
  return unique.size;
}

async function countStandaloneSetStarts(
  supabase: AdminClient,
  studentId: string,
  periodStart: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("student_question_set_attempts")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .is("student_ucat_mock_attempt_id", null)
    .gte("attempted_at", periodStart);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countMockStarts(
  supabase: AdminClient,
  studentId: string,
  periodStart: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("student_ucat_mock_attempts")
    .select("id", { count: "exact", head: true })
    .eq("student_id", studentId)
    .gte("attempted_at", periodStart);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getQuotaUsageForStudent(
  supabase: AdminClient,
  studentId: string,
): Promise<UcatQuotaUsageResponse | null> {
  const ctx = await resolveStudentQuotaContext(supabase, studentId);
  if (!ctx) return null;

  const config = await loadQuotaConfig(supabase);
  const areas: UcatQuotaArea[] = [
    "learn",
    "practice",
    "sets",
    "mocks",
    "skill_trainer",
  ];

  const areaUsages: UcatQuotaAreaUsage[] = await Promise.all(
    areas.map(async (area) => {
      const { limit, period } = getAreaConfig(config, area);
      const used = ctx.isQuotaExempt
        ? 0
        : await countQuotaUsage(supabase, ctx, area, config);
      const disabled = !ctx.isQuotaExempt && limit === 0;
      const atLimit = !ctx.isQuotaExempt && limit > 0 && used >= limit;
      return {
        area,
        label: UCAT_QUOTA_AREA_LABELS[area],
        used: ctx.isQuotaExempt ? 0 : used,
        limit: ctx.isQuotaExempt ? -1 : limit,
        period,
        disabled,
        atLimit,
      };
    }),
  );

  return {
    onlineTier: ctx.onlineTier,
    isQuotaExempt: ctx.isQuotaExempt,
    unlimitedTrialEligible: ctx.unlimitedTrialEligible,
    onboardingCompleted: ctx.onboardingCompleted,
    areas: areaUsages,
  };
}

export type QuotaCheckResult =
  | { allowed: true }
  | { allowed: false; payload: QuotaExceededPayload };

export async function checkQuotaForAction(
  supabase: AdminClient,
  studentId: string,
  area: UcatQuotaArea,
  options?: {
    practiceQuestionId?: string;
    hasAnswer?: boolean;
    learningModuleId?: string;
  },
): Promise<QuotaCheckResult> {
  const ctx = await resolveStudentQuotaContext(supabase, studentId);
  if (!ctx || ctx.isQuotaExempt) return { allowed: true };

  const config = await loadQuotaConfig(supabase);
  const { limit, period } = getAreaConfig(config, area);

  if (limit === 0) {
    return {
      allowed: false,
      payload: {
        code: "QUOTA_EXCEEDED",
        area,
        used: 0,
        limit: 0,
        period,
      },
    };
  }

  if (area === "practice" && options?.practiceQuestionId) {
    return checkPracticeSubmitQuota(
      supabase,
      ctx,
      config,
      options.practiceQuestionId,
      options.hasAnswer ?? false,
    );
  }

  if (area === "learn" && options?.learningModuleId) {
    return checkLearnStartQuota(
      supabase,
      ctx,
      config,
      options.learningModuleId,
    );
  }

  const used = await countQuotaUsage(supabase, ctx, area, config);
  if (used >= limit) {
    return {
      allowed: false,
      payload: {
        code: "QUOTA_EXCEEDED",
        area,
        used,
        limit,
        period,
      },
    };
  }

  return { allowed: true };
}

async function checkPracticeSubmitQuota(
  supabase: AdminClient,
  ctx: StudentQuotaContext,
  config: UcatFreeQuotaConfig,
  questionId: string,
  hasAnswer: boolean,
): Promise<QuotaCheckResult> {
  const { limit, period } = getAreaConfig(config, "practice");

  if (limit === 0) {
    return {
      allowed: false,
      payload: {
        code: "QUOTA_EXCEEDED",
        area: "practice",
        used: 0,
        limit: 0,
        period,
      },
    };
  }

  if (!hasAnswer) return { allowed: true };

  const periodStart = getQuotaPeriodStart(period, ctx.timezone).toISOString();

  const { data: existing } = await supabase
    .from("student_question_attempts")
    .select("id")
    .eq("student_id", ctx.studentId)
    .eq("question_id", questionId)
    .not("student_practice_session_id", "is", null)
    .is("student_question_set_attempt_id", null)
    .or("question_answer_option_id.not.is.null,answer_snapshot.not.is.null")
    .gte("attempted_at", periodStart)
    .maybeSingle();

  if (existing) return { allowed: true };

  const used = await countPracticeUsage(supabase, ctx.studentId, periodStart);
  if (used >= limit) {
    return {
      allowed: false,
      payload: {
        code: "QUOTA_EXCEEDED",
        area: "practice",
        used,
        limit,
        period,
      },
    };
  }

  return { allowed: true };
}

async function checkLearnStartQuota(
  supabase: AdminClient,
  ctx: StudentQuotaContext,
  config: UcatFreeQuotaConfig,
  lessonId: string,
): Promise<QuotaCheckResult> {
  const { limit, period } = getAreaConfig(config, "learn");

  if (limit === 0) {
    return {
      allowed: false,
      payload: {
        code: "QUOTA_EXCEEDED",
        area: "learn",
        used: 0,
        limit: 0,
        period,
      },
    };
  }

  const periodStart = getQuotaPeriodStart(period, ctx.timezone).toISOString();

  const { data: existing } = await supabase
    .from("ucat_student_learning_module_progress")
    .select("id")
    .eq("student_id", ctx.studentId)
    .eq("learning_module_id", lessonId)
    .gte("started_at", periodStart)
    .maybeSingle();

  if (existing) return { allowed: true };

  const used = await countLearnStarts(supabase, ctx.studentId, periodStart);
  if (used >= limit) {
    return {
      allowed: false,
      payload: {
        code: "QUOTA_EXCEEDED",
        area: "learn",
        used,
        limit,
        period,
      },
    };
  }

  return { allowed: true };
}

export function quotaExceededResponse(payload: QuotaExceededPayload) {
  return NextResponse.json(payload, { status: 403 });
}
