import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type ActiveQuestionTiming = {
  questionId: string;
  startedAt: string;
  segmentEndsAt: string | null;
};

function getActiveQuestionTiming(value: unknown): ActiveQuestionTiming | null {
  if (!value || typeof value !== "object") return null;
  const stored = value as {
    state?: {
      activeQuestionTiming?: Partial<ActiveQuestionTiming> | null;
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

function getOpenIntervalSeconds(active: ActiveQuestionTiming): number {
  const startedMs = new Date(active.startedAt).getTime();
  if (!Number.isFinite(startedMs)) return 0;
  const nowMs = Date.now();
  const segmentEndMs = active.segmentEndsAt
    ? new Date(active.segmentEndsAt).getTime()
    : null;
  const requestedEndMs =
    segmentEndMs != null && Number.isFinite(segmentEndMs)
      ? Math.min(nowMs, segmentEndMs)
      : nowMs;
  return Math.max(0, Math.floor((requestedEndMs - startedMs) / 1000));
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
    .select("id, engine_snapshot")
    .eq("id", params.id)
    .eq("student_id", student.id)
    .maybeSingle();

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }
  if (!session) {
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
    return NextResponse.json({ error: attemptsError.message }, { status: 500 });
  }

  const secondsByQuestionId: Record<string, number> = {};
  const submittedQuestionIds: string[] = [];
  for (const attempt of attempts ?? []) {
    if (!attempt.question_id) continue;
    secondsByQuestionId[attempt.question_id] =
      (secondsByQuestionId[attempt.question_id] ?? 0) +
      Math.max(0, attempt.time_spent_seconds ?? 0);
    if (
      attempt.is_submitted ||
      attempt.question_answer_option_id != null ||
      attempt.answer_snapshot != null
    ) {
      submittedQuestionIds.push(attempt.question_id);
    }
  }

  const active = getActiveQuestionTiming(session.engine_snapshot);
  if (active) {
    secondsByQuestionId[active.questionId] =
      (secondsByQuestionId[active.questionId] ?? 0) +
      getOpenIntervalSeconds(active);
  }

  const totalSeconds = Object.values(secondsByQuestionId).reduce(
    (sum, seconds) => sum + seconds,
    0,
  );

  return NextResponse.json({
    secondsByQuestionId,
    submittedQuestionIds: Array.from(new Set(submittedQuestionIds)),
    totalSeconds,
  });
}
