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
import { createUcatNotification } from "@/lib/notifications/create-ucat-notification";
import {
  getInPersonSessionResourceEntitlementIds,
  hasInPersonSessionResourceEntitlement,
} from "@/lib/ucat/quota/in-person-session-entitlement";

type AdminClient = SupabaseClient<Database>;

export type StudentQuotaContext = {
  studentId: string;
  timezone: string;
  onlineTier: UcatOnlineTier;
  isQuotaExempt: boolean;
  unlimitedTrialEligible: boolean;
  onboardingCompleted: boolean;
};

export type UcatQuotaResetEntitlementSummary = {
  availableCount: number;
  nextExpiresAt: string | null;
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

function laterIsoDate(a: string, b: string | null): string {
  if (!b) return a;
  return new Date(b).getTime() > new Date(a).getTime() ? b : a;
}

async function getQuotaCountStart(
  supabase: AdminClient,
  ctx: StudentQuotaContext,
  area: UcatQuotaArea,
  config: UcatFreeQuotaConfig,
): Promise<string> {
  const { period } = getAreaConfig(config, area);
  const periodStart = getQuotaPeriodStart(period, ctx.timezone).toISOString();

  const { data, error } = await supabase.rpc(
    "get_ucat_free_quota_reset_boundary",
    {
      p_student_id: ctx.studentId,
      p_quota_area: area,
    },
  );

  if (error) throw new Error(error.message);
  return laterIsoDate(periodStart, data);
}

export async function getAvailableQuotaResetEntitlementSummary(
  supabase: AdminClient,
  studentId: string,
): Promise<UcatQuotaResetEntitlementSummary> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("ucat_free_quota_reset_entitlements")
    .select("id, expires_at")
    .eq("student_id", studentId)
    .is("used_at", null)
    .gte("expires_at", now)
    .order("expires_at", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return {
    availableCount: data?.length ?? 0,
    nextExpiresAt: data?.[0]?.expires_at ?? null,
  };
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
  const { limit } = getAreaConfig(config, area);
  if (limit <= 0) return 0;

  const countStart = await getQuotaCountStart(supabase, ctx, area, config);

  switch (area) {
    case "practice":
      return countPracticeUsage(supabase, ctx.studentId, countStart);
    case "sets":
      return countStandaloneSetStarts(supabase, ctx.studentId, countStart);
    case "mocks":
      return countMockStarts(supabase, ctx.studentId, countStart);
    case "learn":
      return countLearnStarts(supabase, ctx.studentId, countStart);
    case "skill_trainer":
      return countSkillTrainerStarts(supabase, ctx.studentId, countStart);
  }
}

async function countLearnStarts(
  supabase: AdminClient,
  studentId: string,
  periodStart: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("ucat_student_learning_module_progress")
    .select("learning_module_id, ucat_learning_modules!inner(kind)")
    .eq("student_id", studentId)
    .eq("ucat_learning_modules.kind", "lesson")
    .gte("started_at", periodStart);

  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      return 0;
    }
    throw new Error(error.message);
  }

  const moduleIds = (data ?? []).map((row) => row.learning_module_id);
  const entitledIds = await getInPersonSessionResourceEntitlementIds(
    supabase,
    studentId,
    "learning_module",
    moduleIds,
  );
  return moduleIds.filter((id) => !entitledIds.has(id)).length;
}

async function countSkillTrainerStarts(
  supabase: AdminClient,
  studentId: string,
  periodStart: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("student_skill_trainer_attempts")
    .select("skill_trainer_id")
    .eq("student_id", studentId)
    .is("learning_module_block_id", null)
    .gte("started_at", periodStart);

  if (error) throw new Error(error.message);

  const trainerIds = (data ?? []).map((row) => row.skill_trainer_id);
  const entitledIds = await getInPersonSessionResourceEntitlementIds(
    supabase,
    studentId,
    "skill_trainer",
    trainerIds,
  );
  return trainerIds.filter((id) => !entitledIds.has(id)).length;
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
    .not("first_seen_at", "is", null)
    .gte("first_seen_at", periodStart);

  if (error) throw new Error(error.message);

  const questionIds = Array.from(
    new Set(
      (data ?? [])
        .map((row) => row.question_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const entitledIds = await getInPersonSessionResourceEntitlementIds(
    supabase,
    studentId,
    "question",
    questionIds,
  );
  return questionIds.filter((id) => !entitledIds.has(id)).length;
}

async function countStandaloneSetStarts(
  supabase: AdminClient,
  studentId: string,
  periodStart: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("student_question_set_attempts")
    .select("question_set_id")
    .eq("student_id", studentId)
    .is("student_ucat_mock_attempt_id", null)
    .gte("attempted_at", periodStart);

  if (error) throw new Error(error.message);
  const setIds = (data ?? []).map((row) => row.question_set_id);
  const entitledIds = await getInPersonSessionResourceEntitlementIds(
    supabase,
    studentId,
    "question_set",
    setIds,
  );
  return setIds.filter((id) => !entitledIds.has(id)).length;
}

async function countMockStarts(
  supabase: AdminClient,
  studentId: string,
  periodStart: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("student_ucat_mock_attempts")
    .select("ucat_mock_id")
    .eq("student_id", studentId)
    .gte("attempted_at", periodStart);

  if (error) throw new Error(error.message);
  const mockIds = (data ?? []).map((row) => row.ucat_mock_id);
  const entitledIds = await getInPersonSessionResourceEntitlementIds(
    supabase,
    studentId,
    "mock",
    mockIds,
  );
  return mockIds.filter((id) => !entitledIds.has(id)).length;
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
    quotaResetEntitlement: await getAvailableQuotaResetEntitlementSummary(
      supabase,
      studentId,
    ),
    areas: areaUsages,
  };
}

export type QuotaCheckResult =
  | { allowed: true }
  | { allowed: false; payload: QuotaExceededPayload };

async function rejectQuotaAction(
  supabase: AdminClient,
  studentId: string,
  payload: QuotaExceededPayload,
): Promise<QuotaCheckResult> {
  try {
    const ctx = await resolveStudentQuotaContext(supabase, studentId);
    if (ctx) {
      const config = await loadQuotaConfig(supabase);
      const periodStart = await getQuotaCountStart(
        supabase,
        ctx,
        payload.area,
        config,
      );
      const label = UCAT_QUOTA_AREA_LABELS[payload.area];
      const resetTiming =
        payload.period === "day"
          ? "tomorrow"
          : payload.period === "week"
            ? "next week"
            : "next month";
      await createUcatNotification(supabase, {
        studentId,
        type: "ucat.quota.limit_reached",
        title: `You’ve used your Free ${label.toLowerCase()} allowance`,
        body: `It resets ${resetTiming}, so you can keep preparing on Free. To continue now without limits, choose Unlimited.`,
        actionUrl: "/settings/plan",
        metadata: {
          quota_area: payload.area,
          quota_period: payload.period,
          used: payload.used,
          limit: payload.limit,
          period_start: periodStart,
        },
        dedupeKey: `ucat:quota-limit:${studentId}:${payload.area}:${periodStart}`,
      });
    }
  } catch (error) {
    // Quota enforcement must remain available even if its informational notice fails.
    console.warn("[ucat notifications] Quota-limit notice failed", error);
  }

  return { allowed: false, payload };
}

export type PracticeQuotaStatus = {
  isQuotaExempt: boolean;
  used: number;
  limit: number;
  period: UcatQuotaAreaUsage["period"];
  remaining: number | null;
};

export async function getPracticeQuotaStatusForStudent(
  supabase: AdminClient,
  studentId: string,
): Promise<PracticeQuotaStatus | null> {
  const ctx = await resolveStudentQuotaContext(supabase, studentId);
  if (!ctx) return null;

  const config = await loadQuotaConfig(supabase);
  const { limit, period } = getAreaConfig(config, "practice");
  if (ctx.isQuotaExempt) {
    return {
      isQuotaExempt: true,
      used: 0,
      limit: -1,
      period,
      remaining: null,
    };
  }

  const used = await countQuotaUsage(supabase, ctx, "practice", config);
  return {
    isQuotaExempt: false,
    used,
    limit,
    period,
    remaining: Math.max(0, limit - used),
  };
}

export async function countNewPracticeQuestionsForStudent(
  supabase: AdminClient,
  studentId: string,
  questionIds: string[],
): Promise<number> {
  const ctx = await resolveStudentQuotaContext(supabase, studentId);
  if (!ctx || ctx.isQuotaExempt) return 0;

  const uniqueQuestionIds = Array.from(new Set(questionIds.filter(Boolean)));
  if (uniqueQuestionIds.length === 0) return 0;

  const config = await loadQuotaConfig(supabase);
  const periodStart = await getQuotaCountStart(
    supabase,
    ctx,
    "practice",
    config,
  );

  const { data, error } = await supabase
    .from("student_question_attempts")
    .select("question_id")
    .eq("student_id", studentId)
    .in("question_id", uniqueQuestionIds)
    .not("student_practice_session_id", "is", null)
    .is("student_question_set_attempt_id", null)
    .or(
      "question_answer_option_id.not.is.null,answer_snapshot.not.is.null,is_submitted.eq.true",
    )
    .gte("attempted_at", periodStart);

  if (error) throw new Error(error.message);

  const existing = new Set((data ?? []).map((row) => row.question_id));
  const entitledIds = await getInPersonSessionResourceEntitlementIds(
    supabase,
    studentId,
    "question",
    uniqueQuestionIds,
  );
  return uniqueQuestionIds.filter(
    (id) => !existing.has(id) && !entitledIds.has(id),
  ).length;
}

export async function checkPracticeStartQuota(
  supabase: AdminClient,
  studentId: string,
  questionIds: string[],
): Promise<QuotaCheckResult> {
  const status = await getPracticeQuotaStatusForStudent(supabase, studentId);
  if (!status || status.isQuotaExempt) return { allowed: true };

  const newQuestionCount = await countNewPracticeQuestionsForStudent(
    supabase,
    studentId,
    questionIds,
  );
  if (newQuestionCount === 0) return { allowed: true };

  if (newQuestionCount > (status.remaining ?? 0)) {
    return rejectQuotaAction(supabase, studentId, {
      code: "QUOTA_EXCEEDED",
      area: "practice",
      used: status.used,
      limit: status.limit,
      period: status.period,
    });
  }

  return { allowed: true };
}

export async function checkQuotaForAction(
  supabase: AdminClient,
  studentId: string,
  area: UcatQuotaArea,
  options?: {
    practiceQuestionId?: string;
    hasAnswer?: boolean;
    learningModuleId?: string;
    questionSetId?: string;
    mockId?: string;
    skillTrainerId?: string;
  },
): Promise<QuotaCheckResult> {
  const ctx = await resolveStudentQuotaContext(supabase, studentId);
  if (!ctx || ctx.isQuotaExempt) return { allowed: true };

  const inPersonResource = (
    area === "practice" && options?.practiceQuestionId
      ? ["question", options.practiceQuestionId]
      : area === "sets" && options?.questionSetId
        ? ["question_set", options.questionSetId]
        : area === "mocks" && options?.mockId
          ? ["mock", options.mockId]
          : area === "learn" && options?.learningModuleId
            ? ["learning_module", options.learningModuleId]
            : area === "skill_trainer" && options?.skillTrainerId
              ? ["skill_trainer", options.skillTrainerId]
              : null
  ) as
    | [
        (
          | "question"
          | "question_set"
          | "mock"
          | "learning_module"
          | "skill_trainer"
        ),
        string,
      ]
    | null;
  if (
    inPersonResource &&
    (await hasInPersonSessionResourceEntitlement(
      supabase,
      studentId,
      inPersonResource[0],
      inPersonResource[1],
    ))
  ) {
    return { allowed: true };
  }

  const config = await loadQuotaConfig(supabase);
  const { limit, period } = getAreaConfig(config, area);

  if (limit === 0) {
    return rejectQuotaAction(supabase, studentId, {
      code: "QUOTA_EXCEEDED",
      area,
      used: 0,
      limit: 0,
      period,
    });
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
    return rejectQuotaAction(supabase, studentId, {
      code: "QUOTA_EXCEEDED",
      area,
      used,
      limit,
      period,
    });
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
    return rejectQuotaAction(supabase, ctx.studentId, {
      code: "QUOTA_EXCEEDED",
      area: "practice",
      used: 0,
      limit: 0,
      period,
    });
  }

  if (!hasAnswer) return { allowed: true };

  const countStart = await getQuotaCountStart(
    supabase,
    ctx,
    "practice",
    config,
  );

  const { data: existing } = await supabase
    .from("student_question_attempts")
    .select("id")
    .eq("student_id", ctx.studentId)
    .eq("question_id", questionId)
    .not("student_practice_session_id", "is", null)
    .is("student_question_set_attempt_id", null)
    .not("first_seen_at", "is", null)
    .gte("first_seen_at", countStart)
    .maybeSingle();

  if (existing) return { allowed: true };

  const used = await countPracticeUsage(supabase, ctx.studentId, countStart);
  if (used >= limit) {
    return rejectQuotaAction(supabase, ctx.studentId, {
      code: "QUOTA_EXCEEDED",
      area: "practice",
      used,
      limit,
      period,
    });
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
    return rejectQuotaAction(supabase, ctx.studentId, {
      code: "QUOTA_EXCEEDED",
      area: "learn",
      used: 0,
      limit: 0,
      period,
    });
  }

  const countStart = await getQuotaCountStart(supabase, ctx, "learn", config);

  const { data: existing } = await supabase
    .from("ucat_student_learning_module_progress")
    .select("id")
    .eq("student_id", ctx.studentId)
    .eq("learning_module_id", lessonId)
    .maybeSingle();

  if (existing) return { allowed: true };

  const used = await countLearnStarts(supabase, ctx.studentId, countStart);
  if (used >= limit) {
    return rejectQuotaAction(supabase, ctx.studentId, {
      code: "QUOTA_EXCEEDED",
      area: "learn",
      used,
      limit,
      period,
    });
  }

  return { allowed: true };
}

export function quotaExceededResponse(payload: QuotaExceededPayload) {
  return NextResponse.json(payload, { status: 403 });
}
