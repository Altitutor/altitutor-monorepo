import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { maybeAutoCompleteQuestionBlock } from "@/lib/ucat/learning/progress-service";
import {
  persistQuestionAttemptBatch,
  type QuestionAttemptBatchInput,
} from "@/lib/ucat/question-attempts/persist-question-attempt-batch";
import { findUndeliveredPracticeQuestionIds } from "@/lib/ucat/practice-sessions/authorize-delivered-questions";
import { captureUcatLearningActivityCompletedInBackground } from "@/lib/analytics/posthog-server";
import {
  PRACTICE_SESSION_ENDED_CODE,
  PRACTICE_SESSION_ENDED_MESSAGE,
} from "@/lib/ucat/practice-sessions/practice-session-ended";
import { parseQuotaExceededMessage } from "@/lib/ucat/quota/parse-quota-error";
import { quotaExceededResponse } from "@/lib/ucat/quota/quota-service";

type BatchRequest = {
  studentQuestionSetAttemptId: string | null;
  studentPracticeSessionId?: string | null;
  learningModuleBlockId?: string | null;
  attempts?: QuestionAttemptBatchInput[];
};

export async function POST(request: NextRequest) {
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

  const body = (await request.json().catch(() => null)) as BatchRequest | null;
  if (!body) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
  const attempts = (body.attempts ?? []).filter((item) => item.questionId);
  if (attempts.length === 0 || attempts.length > 500) {
    return NextResponse.json(
      { error: "Expected between 1 and 500 question attempts" },
      { status: 400 },
    );
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (studentError) {
    captureApiError(studentError, "/api/ucat/question-attempts/batch");
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  const practiceSessionId = body.studentPracticeSessionId || null;
  const learningModuleBlockId = body.learningModuleBlockId || null;
  const setAttemptId = practiceSessionId
    ? null
    : body.studentQuestionSetAttemptId || null;

  if (practiceSessionId) {
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("student_practice_sessions")
      .select("stems_snapshot, completed_at, discarded_at, expired_at")
      .eq("id", practiceSessionId)
      .eq("student_id", student.id)
      .maybeSingle();
    if (sessionError) {
      captureApiError(sessionError, "/api/ucat/question-attempts/batch");
      return NextResponse.json(
        { error: sessionError.message },
        { status: 500 },
      );
    }

    if (
      !session ||
      session.completed_at ||
      session.discarded_at ||
      session.expired_at
    ) {
      return NextResponse.json(
        {
          code: PRACTICE_SESSION_ENDED_CODE,
          error: PRACTICE_SESSION_ENDED_MESSAGE,
        },
        { status: 410 },
      );
    }

    const undeliveredQuestionIds = findUndeliveredPracticeQuestionIds(
      session.stems_snapshot,
      attempts.map((attempt) => attempt.questionId),
    );
    if (undeliveredQuestionIds.length > 0) {
      return NextResponse.json(
        { error: "Question is not part of this practice session" },
        { status: 403 },
      );
    }
  } else if (setAttemptId) {
    const { data: setAttempt, error: setAttemptError } = await supabaseAdmin
      .from("student_question_set_attempts")
      .select("id, completed_at, discarded_at, expired_at")
      .eq("id", setAttemptId)
      .eq("student_id", student.id)
      .maybeSingle();
    if (setAttemptError) {
      captureApiError(setAttemptError, "/api/ucat/question-attempts/batch");
      return NextResponse.json(
        { error: setAttemptError.message },
        { status: 500 },
      );
    }
    if (
      !setAttempt ||
      setAttempt.completed_at ||
      setAttempt.discarded_at ||
      setAttempt.expired_at
    ) {
      return NextResponse.json(
        { error: "Question set attempt is not active" },
        { status: 403 },
      );
    }
  }

  try {
    await persistQuestionAttemptBatch(
      supabaseAdmin,
      student.id,
      {
        studentQuestionSetAttemptId: setAttemptId,
        studentPracticeSessionId: practiceSessionId,
        learningModuleBlockId,
      },
      attempts.map(({ score: _clientScore, ...attempt }) => attempt),
    );

    if (
      learningModuleBlockId &&
      attempts.some(
        (attempt) =>
          attempt.submittedByStem === true || attempt.answerSnapshot != null,
      )
    ) {
      try {
        const progress = await maybeAutoCompleteQuestionBlock(
          supabaseAdmin,
          student.id,
          learningModuleBlockId,
        );
        if (progress.lessonNewlyCompleted && progress.lessonId) {
          captureUcatLearningActivityCompletedInBackground({
            userId: user.id,
            activityType: "lesson",
            activityId: progress.lessonId,
            properties: { completion_source: "lesson_question_auto" },
          });
        }
      } catch {
        // Progress is best-effort; the attempts are already safely stored.
      }
    }

    return NextResponse.json({ success: true, count: attempts.length });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to persist question attempts";
    const quota = parseQuotaExceededMessage(message);
    if (quota) return quotaExceededResponse(quota);
    captureApiError(error, "/api/ucat/question-attempts/batch");
    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 },
    );
  }
}
