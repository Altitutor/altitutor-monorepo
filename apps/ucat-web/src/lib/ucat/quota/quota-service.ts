import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
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
  proTrialEligible: boolean;
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
  const { data: student, error } = await supabase
    .from("students")
    .select(
      "id, timezone, ucat_online_tier_override, ucat_onboarding_completed_at, ucat_pro_trial_consumed_at",
    )
    .eq("id", studentId)
    .maybeSingle();

  if (error || !student) return null;

  const ucatSubjectId = await getUcatSubjectId(supabase);
  const { data: subscription } = ucatSubjectId
    ? await supabase
        .from("student_subscriptions")
        .select("status")
        .eq("student_id", studentId)
        .eq("subject_id", ucatSubjectId)
        .in("status", ["trialing", "active"])
        .maybeSingle()
    : { data: null };

  const onlineTier = resolveOnlineTier(
    student.ucat_online_tier_override,
    subscription?.status ?? null,
  );

  return {
    studentId,
    timezone: student.timezone ?? "Australia/Adelaide",
    onlineTier,
    isQuotaExempt: onlineTier === "pro" || onlineTier === "pro_trial",
    proTrialEligible: student.ucat_pro_trial_consumed_at == null,
    onboardingCompleted: student.ucat_onboarding_completed_at != null,
  };
}

function resolveOnlineTier(
  override: string,
  subscriptionStatus: string | null,
): UcatOnlineTier {
  if (override === "force_free") return "free";
  if (override === "force_pro") return "pro";
  if (subscriptionStatus === "trialing") return "pro_trial";
  if (subscriptionStatus === "active") return "pro";
  return "free";
}

async function getUcatSubjectId(
  supabase: AdminClient,
): Promise<string | null> {
  const { data } = await supabase
    .from("subjects")
    .select("id")
    .eq("name", "UCAT")
    .maybeSingle();
  return data?.id ?? null;
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
    case "skill_trainer":
      return 0;
  }
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
    .gte("created_at", periodStart);

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
    proTrialEligible: ctx.proTrialEligible,
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
  options?: { practiceQuestionId?: string; hasAnswer?: boolean },
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
    .gte("created_at", periodStart)
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

export function quotaExceededResponse(payload: QuotaExceededPayload) {
  return NextResponse.json(payload, { status: 403 });
}
