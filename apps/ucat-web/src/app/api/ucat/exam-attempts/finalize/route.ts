import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { finalizeExamAttemptOnServer } from "@/lib/ucat/exam-attempt/finalize-attempt";
import type { ExamAttemptKind } from "@/lib/ucat/exam-attempt/types";
import type { FinalExamQuestionAttemptInput } from "@/lib/ucat/exam-attempt/finalize-attempt";
import { captureUcatLearningActivityCompleted } from "@/lib/analytics/posthog-server";
import { maybeGrantPracticeDayDiscount } from "@/lib/ucat/practice-day-discount";
import { ServerTiming } from "@/lib/performance/server-timing";

export async function POST(request: NextRequest) {
  const timing = new ServerTiming();
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  timing.mark("auth");

  if (authError) {
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server write client not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    kind?: ExamAttemptKind;
    attemptId?: string;
    complete?: boolean;
    answers?: FinalExamQuestionAttemptInput[];
  };

  if (!body.kind || !body.attemptId || !body.complete) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  timing.mark("student");

  if (studentError) {
    captureApiError(studentError, "/api/ucat/exam-attempts/finalize");
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  try {
    const result = await finalizeExamAttemptOnServer(
      supabaseAdmin,
      student.id,
      body.kind,
      body.attemptId,
      body.answers,
      { grantDiscount: false },
    );
    timing.mark("finalize");
    let discount = {
      earnedDiscount: result.earnedDiscount ?? false,
      discountCents: result.discountCents ?? 0,
    };
    if (result.newlyCompleted) {
      const [, earnedDiscount] = await Promise.all([
        captureUcatLearningActivityCompleted({
          userId: user.id,
          activityType: body.kind,
          activityId: body.attemptId,
          properties: { completion_source: "question_engine" },
        }),
        maybeGrantPracticeDayDiscount(supabaseAdmin, student.id),
      ]);
      discount = earnedDiscount;
    }
    timing.mark("side_effects");
    return timing.apply(NextResponse.json({ ...result, ...discount }));
  } catch (error) {
    captureApiError(error, "/api/ucat/exam-attempts/finalize");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to finalize exam attempt",
      },
      { status: 500 },
    );
  }
}
