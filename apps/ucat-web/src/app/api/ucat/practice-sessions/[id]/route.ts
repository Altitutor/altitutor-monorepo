import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { maybeGrantPracticeDayDiscount } from "@/lib/ucat/practice-day-discount";
import type { FinalQuestionAttemptInput } from "@/lib/ucat/set-attempts/complete-student-set-attempt";
import { completeStudentPracticeSession } from "@/lib/ucat/practice-sessions/complete-student-practice-session";
import { captureUcatLearningActivityCompletedInBackground } from "@/lib/analytics/posthog-server";
import { ServerTiming } from "@/lib/performance/server-timing";
import { waitUntil } from "@vercel/functions";
import { processPendingPreparationRefreshes } from "@/features/preparation/server/preparation-refresh-worker";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
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
    return NextResponse.json(
      { error: "Server write client not configured" },
      { status: 500 },
    );
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) {
    captureApiError(studentError, "/api/ucat/practice-sessions/[id]");
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  const { data: session, error } = await supabaseAdmin
    .from("student_practice_sessions")
    .select(
      "id, stems_snapshot, filters_snapshot, unlimited, started_at, completed_at, discarded_at, expired_at",
    )
    .eq("id", params.id)
    .eq("student_id", student.id)
    .maybeSingle();

  if (error) {
    captureApiError(error, "/api/ucat/practice-sessions/[id]");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!session || session.discarded_at || session.expired_at) {
    return NextResponse.json(
      { error: "Practice session not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: session.id,
    stemsSnapshot: session.stems_snapshot,
    filtersSnapshot: session.filters_snapshot,
    unlimited: session.unlimited,
    startedAt: session.started_at,
    completedAt: session.completed_at,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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
    complete?: boolean;
    answers?: FinalQuestionAttemptInput[];
  };

  if (!body.complete) {
    return NextResponse.json(
      { error: "Unsupported operation" },
      { status: 400 },
    );
  }
  if (!Array.isArray(body.answers)) {
    return NextResponse.json(
      { error: "Final answers are required" },
      { status: 400 },
    );
  }
  if (body.answers.length > 500) {
    return NextResponse.json(
      { error: "Too many question attempts" },
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
    captureApiError(studentError, "/api/ucat/practice-sessions/[id]");
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }

  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  const sessionId = params.id;
  try {
    const completion = await completeStudentPracticeSession(
      supabaseAdmin,
      student.id,
      sessionId,
      body.answers,
    );
    timing.mark("complete");

    if (!completion.newlyCompleted) {
      return timing.apply(
        NextResponse.json({
          success: true,
          alreadyCompleted: true,
          earnedDiscount: false,
          discountCents: 0,
        }),
      );
    }

    captureUcatLearningActivityCompletedInBackground({
      userId: user.id,
      activityType: "practice",
      activityId: sessionId,
      properties: {
        completion_source: "practice_session",
        question_count: completion.questionCount,
      },
    });
    const discount = await maybeGrantPracticeDayDiscount(
      supabaseAdmin,
      student.id,
    );
    waitUntil(
      processPendingPreparationRefreshes({
        studentId: student.id,
        limit: 1,
      }),
    );
    timing.mark("discount");
    return timing.apply(
      NextResponse.json({
        success: true,
        earnedDiscount: discount.earnedDiscount,
        discountCents: discount.discountCents,
      }),
    );
  } catch (error) {
    captureApiError(error, "/api/ucat/practice-sessions/[id]");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to complete practice session",
      },
      { status: 500 },
    );
  }
}
