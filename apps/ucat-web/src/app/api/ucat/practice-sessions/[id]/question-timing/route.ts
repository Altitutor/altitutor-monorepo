import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PracticeActiveQuestionTiming } from "@/features/question-engine/lib/practice-question-timing";

function getActiveQuestionTiming(
  value: unknown,
): PracticeActiveQuestionTiming | null {
  if (!value || typeof value !== "object") return null;
  const stored = value as {
    state?: {
      activeQuestionTiming?: Partial<PracticeActiveQuestionTiming> | null;
    };
  };
  const active = stored.state?.activeQuestionTiming;
  if (
    !active?.questionId ||
    typeof active.questionId !== "string" ||
    !active.startedAt ||
    typeof active.startedAt !== "string"
  ) {
    return null;
  }
  return {
    questionId: active.questionId,
    startedAt: active.startedAt,
    segmentEndsAt:
      typeof active.segmentEndsAt === "string" ? active.segmentEndsAt : null,
  };
}

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
    captureApiError(
      studentError,
      "/api/ucat/practice-sessions/[id]/question-timing",
    );
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("student_practice_sessions")
    .select("id, engine_snapshot, completed_at, discarded_at, expired_at")
    .eq("id", params.id)
    .eq("student_id", student.id)
    .maybeSingle();

  if (sessionError) {
    captureApiError(
      sessionError,
      "/api/ucat/practice-sessions/[id]/question-timing",
    );
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }
  if (
    !session ||
    session.completed_at ||
    session.discarded_at ||
    session.expired_at
  ) {
    return NextResponse.json(
      { error: "Practice session not found" },
      { status: 404 },
    );
  }

  const { data: attempts, error: attemptsError } = await supabaseAdmin
    .from("student_question_attempts")
    .select(
      "question_id, time_spent_seconds, question_answer_option_id, answer_snapshot, is_submitted",
    )
    .eq("student_id", student.id)
    .eq("student_practice_session_id", params.id)
    .is("student_question_set_attempt_id", null);

  if (attemptsError) {
    captureApiError(
      attemptsError,
      "/api/ucat/practice-sessions/[id]/question-timing",
    );
    return NextResponse.json({ error: attemptsError.message }, { status: 500 });
  }

  const persistedSecondsByQuestionId: Record<string, number> = {};
  const submittedQuestionIds: string[] = [];
  for (const attempt of attempts ?? []) {
    if (!attempt.question_id) continue;
    persistedSecondsByQuestionId[attempt.question_id] =
      (persistedSecondsByQuestionId[attempt.question_id] ?? 0) +
      Math.max(0, attempt.time_spent_seconds ?? 0);
    if (
      attempt.is_submitted ||
      attempt.question_answer_option_id != null ||
      attempt.answer_snapshot != null
    ) {
      submittedQuestionIds.push(attempt.question_id);
    }
  }

  const activeQuestionTiming = getActiveQuestionTiming(session.engine_snapshot);

  return NextResponse.json({
    persistedSecondsByQuestionId,
    activeQuestionTiming,
    submittedQuestionIds: Array.from(new Set(submittedQuestionIds)),
  });
}
