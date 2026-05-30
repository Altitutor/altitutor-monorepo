import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { StudyPlannerSettings } from "@/features/study-planner/types/study-planner";

const MIN_SCORE = 300;
const MAX_SCORE = 900;

type TargetScoresInput = {
  s1?: number | null;
  s2?: number | null;
  s3?: number | null;
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

function isValidScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MIN_SCORE &&
    value <= MAX_SCORE
  );
}

function normalizeTargetScore(
  value: unknown,
  key: string,
): number | null | { error: string } {
  if (value == null) return null;
  if (!isValidScore(value)) {
    return { error: `${key} must be between ${MIN_SCORE} and ${MAX_SCORE}` };
  }
  return Math.round(value);
}

function normalizeTestDate(value: unknown): string | null | { error: string } {
  if (value == null) return null;
  if (typeof value !== "string" || value.trim().length === 0) {
    return { error: "testDate must be a yyyy-mm-dd string" };
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { error: "testDate must be a valid date" };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed < today) {
    return { error: "testDate must be today or a future date" };
  }

  return value;
}

async function resolveStudentId(userId: string): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.id) return null;
  return data.id;
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
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const studentId = await resolveStudentId(user.id);
  if (!studentId) {
    return NextResponse.json<StudyPlannerSettings>({
      testDate: null,
      targetScores: { s1: null, s2: null, s3: null },
    });
  }

  const { data, error } = await supabaseAdmin
    .from("students")
    .select(
      "ucat_test_date, ucat_target_score_s1, ucat_target_score_s2, ucat_target_score_s3",
    )
    .eq("id", studentId)
    .maybeSingle();

  if (error) {
    if (isMissingStudyPlannerColumnError(error)) {
      return NextResponse.json<StudyPlannerSettings>({
        testDate: null,
        targetScores: { s1: null, s2: null, s3: null },
      });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload: StudyPlannerSettings = {
    testDate: data?.ucat_test_date ?? null,
    targetScores: {
      s1: data?.ucat_target_score_s1 ?? null,
      s2: data?.ucat_target_score_s2 ?? null,
      s3: data?.ucat_target_score_s3 ?? null,
    },
  };

  return NextResponse.json(payload);
}

export async function PATCH(request: NextRequest) {
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
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const body = (await request.json()) as {
    testDate?: unknown;
    targetScores?: TargetScoresInput;
  };

  const normalizedDate = normalizeTestDate(body.testDate);
  if (typeof normalizedDate === "object" && normalizedDate?.error) {
    return NextResponse.json({ error: normalizedDate.error }, { status: 400 });
  }

  const targetScores = body.targetScores ?? {};
  const s1 = normalizeTargetScore(targetScores.s1, "targetScores.s1");
  if (typeof s1 === "object" && s1?.error) {
    return NextResponse.json({ error: s1.error }, { status: 400 });
  }
  const s2 = normalizeTargetScore(targetScores.s2, "targetScores.s2");
  if (typeof s2 === "object" && s2?.error) {
    return NextResponse.json({ error: s2.error }, { status: 400 });
  }
  const s3 = normalizeTargetScore(targetScores.s3, "targetScores.s3");
  if (typeof s3 === "object" && s3?.error) {
    return NextResponse.json({ error: s3.error }, { status: 400 });
  }
  const safeTestDate = typeof normalizedDate === "string" ? normalizedDate : null;
  const safeS1 = typeof s1 === "number" ? s1 : null;
  const safeS2 = typeof s2 === "number" ? s2 : null;
  const safeS3 = typeof s3 === "number" ? s3 : null;

  const hasAnyField =
    body.testDate !== undefined ||
    targetScores.s1 !== undefined ||
    targetScores.s2 !== undefined ||
    targetScores.s3 !== undefined;
  if (!hasAnyField) {
    return NextResponse.json(
      { error: "Provide testDate and/or targetScores to update" },
      { status: 400 },
    );
  }

  const studentId = await resolveStudentId(user.id);
  if (!studentId) {
    return NextResponse.json(
      { warning: "No student profile found; settings update skipped" },
      { status: 200 },
    );
  }

  const updates: Record<string, string | number | null> = {
    updated_at: new Date().toISOString(),
  };
  if (body.testDate !== undefined) updates.ucat_test_date = safeTestDate;
  if (targetScores.s1 !== undefined) updates.ucat_target_score_s1 = safeS1;
  if (targetScores.s2 !== undefined) updates.ucat_target_score_s2 = safeS2;
  if (targetScores.s3 !== undefined) updates.ucat_target_score_s3 = safeS3;

  const { error } = await supabaseAdmin
    .from("students")
    .update(updates)
    .eq("id", studentId);

  if (error) {
    if (isMissingStudyPlannerColumnError(error)) {
      return NextResponse.json(
        {
          warning:
            "Study planner columns not available yet; migration likely pending",
        },
        { status: 200 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    testDate: body.testDate !== undefined ? safeTestDate : undefined,
    targetScores: {
      s1: targetScores.s1 !== undefined ? safeS1 : undefined,
      s2: targetScores.s2 !== undefined ? safeS2 : undefined,
      s3: targetScores.s3 !== undefined ? safeS3 : undefined,
    },
  });
}
