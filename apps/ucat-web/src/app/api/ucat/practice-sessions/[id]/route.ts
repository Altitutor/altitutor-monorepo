import { captureApiError } from "@/lib/sentry/capture-api-error";
import type { Json } from "@altitutor/shared";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { maybeGrantPracticeDayDiscount } from "@/lib/ucat/practice-day-discount";
import {
  persistQuestionAttemptBatch,
  type QuestionAttemptBatchInput,
} from "@/lib/ucat/question-attempts/persist-question-attempt-batch";
import { findUndeliveredPracticeQuestionIds } from "@/lib/ucat/practice-sessions/authorize-delivered-questions";
import { captureUcatLearningActivityCompleted } from "@/lib/analytics/posthog-server";

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
      "id, stems_snapshot, filters_snapshot, unlimited, completed_at, discarded_at, expired_at",
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
    completedAt: session.completed_at,
  });
}

export async function PATCH(
  request: NextRequest,
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

  const body = (await request.json()) as {
    complete?: boolean;
    scorePoints?: number;
    totalPoints?: number;
    questionCount?: number;
    stemsSnapshot?: unknown;
    questionScores?: Array<{ questionId: string; score: number }>;
    answers?: QuestionAttemptBatchInput[];
  };

  if (!body.complete) {
    return NextResponse.json(
      { error: "Unsupported operation" },
      { status: 400 },
    );
  }
  if (body.answers && body.answers.length > 500) {
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

  const { data: session, error: sessionError } = await supabaseAdmin
    .from("student_practice_sessions")
    .select(
      "id, student_id, completed_at, discarded_at, expired_at, stems_snapshot",
    )
    .eq("id", sessionId)
    .eq("student_id", student.id)
    .maybeSingle();

  if (sessionError) {
    captureApiError(sessionError, "/api/ucat/practice-sessions/[id]");
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json(
      { error: "Practice session not found" },
      { status: 404 },
    );
  }

  if (session.completed_at) {
    // Treat retries after a lost response as success. The final write is
    // intentionally idempotent so students are never stranded in the engine.
    return NextResponse.json({
      success: true,
      alreadyCompleted: true,
      earnedDiscount: false,
      discountCents: 0,
    });
  }
  if (session.discarded_at || session.expired_at) {
    return NextResponse.json(
      { error: "Practice session is no longer active" },
      { status: 409 },
    );
  }

  const scorePoints = body.scorePoints ?? 0;
  const totalPoints = body.totalPoints ?? 0;
  const questionCount = body.questionCount ?? 0;
  const stemsSnapshot = (body.stemsSnapshot ?? null) as Json | null;
  const questionScores = body.questionScores ?? [];

  if (body.answers) {
    try {
      const undeliveredQuestionIds = await findUndeliveredPracticeQuestionIds(
        supabaseAdmin,
        session.stems_snapshot,
        body.answers.map((answer) => answer.questionId),
      );
      if (undeliveredQuestionIds.length > 0) {
        return NextResponse.json(
          { error: "Question is not part of this practice session" },
          { status: 403 },
        );
      }
    } catch (error) {
      captureApiError(error, "/api/ucat/practice-sessions/[id]");
      return NextResponse.json(
        { error: "Failed to validate practice questions" },
        { status: 500 },
      );
    }

    const scoreByQuestionId = new Map(
      questionScores.map((question) => [question.questionId, question.score]),
    );
    try {
      await persistQuestionAttemptBatch(
        supabaseAdmin,
        student.id,
        {
          studentQuestionSetAttemptId: null,
          studentPracticeSessionId: sessionId,
          learningModuleBlockId: null,
        },
        body.answers.map((answer) => ({
          ...answer,
          submittedByStem: true,
          score: scoreByQuestionId.get(answer.questionId) ?? answer.score ?? 0,
        })),
      );
    } catch (error) {
      captureApiError(error, "/api/ucat/practice-sessions/[id]");
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Failed to save final answers",
        },
        { status: 500 },
      );
    }
  }

  const { data: attempts, error: attemptsError } = body.answers
    ? { data: null, error: null }
    : await supabaseAdmin
        .from("student_question_attempts")
        .select("id, question_id, student_id")
        .eq("student_practice_session_id", sessionId)
        .eq("student_id", student.id);

  if (attemptsError) {
    captureApiError(attemptsError, "/api/ucat/practice-sessions/[id]");
    return NextResponse.json({ error: attemptsError.message }, { status: 500 });
  }

  const scoreByQuestionId = new Map(
    questionScores.map((q) => [q.questionId, q.score]),
  );

  if (attempts && attempts.length > 0) {
    const updates = attempts.map((qa) => ({
      id: qa.id,
      question_id: qa.question_id,
      student_id: qa.student_id,
      score: qa.question_id ? (scoreByQuestionId.get(qa.question_id) ?? 0) : 0,
      is_submitted: true,
    }));

    const { error: updateError } = await supabaseAdmin
      .from("student_question_attempts")
      .upsert(updates, { onConflict: "id" });

    if (updateError) {
      captureApiError(updateError, "/api/ucat/practice-sessions/[id]");
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from("student_practice_sessions")
    .update({
      completed_at: new Date().toISOString(),
      score_points: scorePoints,
      total_points: totalPoints,
      question_count: questionCount,
      stems_snapshot: stemsSnapshot,
      prefetched_stem_snapshot: null,
      engine_snapshot: null,
      current_segment_ends_at: null,
    })
    .eq("id", sessionId)
    .eq("student_id", student.id)
    .is("discarded_at", null)
    .is("expired_at", null);

  if (updateError) {
    captureApiError(updateError, "/api/ucat/practice-sessions/[id]");
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await captureUcatLearningActivityCompleted({
    userId: user.id,
    activityType: "practice",
    activityId: sessionId,
    properties: {
      completion_source: "practice_session",
      question_count: questionCount,
    },
  });

  const discount = await maybeGrantPracticeDayDiscount(
    supabaseAdmin,
    student.id,
  );
  return NextResponse.json({
    success: true,
    earnedDiscount: discount.earnedDiscount,
    discountCents: discount.discountCents,
  });
}
