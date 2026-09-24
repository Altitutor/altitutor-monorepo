import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import type { Json } from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { maybeAutoCompleteQuestionBlock } from "@/lib/ucat/learning/progress-service";
import { findUndeliveredPracticeQuestionIds } from "@/lib/ucat/practice-sessions/authorize-delivered-questions";
import { captureUcatLearningActivityCompletedInBackground } from "@/lib/analytics/posthog-server";
import {
  PRACTICE_SESSION_ENDED_CODE,
  PRACTICE_SESSION_ENDED_MESSAGE,
} from "@/lib/ucat/practice-sessions/practice-session-ended";
import { parseQuotaExceededMessage } from "@/lib/ucat/quota/parse-quota-error";
import { quotaExceededResponse } from "@/lib/ucat/quota/quota-service";

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

  const body = (await request.json()) as {
    studentQuestionSetAttemptId: string | null;
    studentPracticeSessionId?: string | null;
    questionId: string;
    answerSnapshot?: Json | null;
    isFlagged?: boolean;
    wasTimed?: boolean;
    learningModuleBlockId?: string | null;
    mode?: "question" | "question_stem" | "set" | "mock" | "learn";
    submittedByStem?: boolean;
  };

  if (!body.questionId) {
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

  if (studentError) {
    return NextResponse.json(
      { error: "Failed to resolve student" },
      { status: 500 },
    );
  }

  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  const isLearnAttempt =
    body.learningModuleBlockId != null && body.learningModuleBlockId !== "";
  const isPracticeAttempt =
    !isLearnAttempt &&
    body.studentPracticeSessionId != null &&
    body.studentPracticeSessionId !== "" &&
    body.studentQuestionSetAttemptId === null;

  if (isPracticeAttempt) {
    const { data: session, error: sessionError } = await supabaseAdmin
      .from("student_practice_sessions")
      .select(
        "id, stems_snapshot, unlimited, completed_at, discarded_at, expired_at",
      )
      .eq("id", body.studentPracticeSessionId!)
      .eq("student_id", student.id)
      .maybeSingle();

    if (sessionError) {
      captureApiError(sessionError, "/api/ucat/question-attempts");
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
      [body.questionId],
    );
    if (undeliveredQuestionIds.length > 0) {
      return NextResponse.json(
        { error: "Question is not part of this practice session" },
        { status: 403 },
      );
    }
  }

  let query = supabaseAdmin
    .from("student_question_attempts")
    .select("id")
    .eq("student_id", student.id)
    .eq("question_id", body.questionId);

  if (
    body.studentPracticeSessionId != null &&
    body.studentPracticeSessionId !== ""
  ) {
    query = query
      .is("student_question_set_attempt_id", null)
      .eq("student_practice_session_id", body.studentPracticeSessionId);
  } else if (isLearnAttempt) {
    query = query.eq("learning_module_block_id", body.learningModuleBlockId!);
  } else if (body.studentQuestionSetAttemptId === null) {
    query = query
      .is("student_question_set_attempt_id", null)
      .is("student_practice_session_id", null)
      .is("learning_module_block_id", null);
  } else {
    query = query.eq(
      "student_question_set_attempt_id",
      body.studentQuestionSetAttemptId,
    );
  }

  const { data: existing, error: existingError } = await query.maybeSingle();

  if (
    existingError &&
    existingError.code !== "PGRST116" &&
    existingError.code !== "PGRST123"
  ) {
    captureApiError(existingError, "/api/ucat/question-attempts");
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const hasFlag = typeof body.isFlagged === "boolean";
  const isSubmitted = body.submittedByStem === true;

  if (existing) {
    const updatePayload: {
      answer_snapshot?: Json | null;
      is_submitted?: boolean;
      is_flagged?: boolean;
      was_timed?: boolean;
      mode?: "question" | "question_stem" | "set" | "mock" | "learn";
      learning_module_block_id?: string | null;
    } = {};

    if (Object.prototype.hasOwnProperty.call(body, "answerSnapshot")) {
      updatePayload.answer_snapshot = body.answerSnapshot ?? null;
    }

    if (isSubmitted) {
      updatePayload.is_submitted = true;
    }

    if (hasFlag) {
      updatePayload.is_flagged = body.isFlagged ?? false;
    }

    if (typeof body.wasTimed === "boolean") {
      updatePayload.was_timed = body.wasTimed;
    }
    if (body.mode) {
      updatePayload.mode = body.mode;
    }

    const { error: updateError } = await supabaseAdmin
      .from("student_question_attempts")
      .update(updatePayload)
      .eq("id", existing.id)
      .eq("student_id", student.id);

    if (updateError) {
      captureApiError(updateError, "/api/ucat/question-attempts");
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const hasAnswer = body.answerSnapshot != null;
    if (isLearnAttempt && hasAnswer) {
      try {
        const progress = await maybeAutoCompleteQuestionBlock(
          supabaseAdmin,
          student.id,
          body.learningModuleBlockId!,
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
        // Progress update is best-effort; attempt is already saved.
      }
    }

    return NextResponse.json({ id: existing.id });
  }

  const practiceSessionId =
    body.studentPracticeSessionId != null &&
    body.studentPracticeSessionId !== ""
      ? body.studentPracticeSessionId
      : null;
  const setAttemptId = practiceSessionId
    ? null
    : body.studentQuestionSetAttemptId;

  const insertPayload: {
    student_id: string;
    student_question_set_attempt_id: string | null;
    student_practice_session_id: string | null;
    question_id: string;
    answer_snapshot: Json | null;
    is_flagged: boolean;
    is_submitted: boolean;
    time_spent_seconds: number | null;
    first_seen_at?: string;
    was_timed: boolean;
    mode: "question" | "question_stem" | "set" | "mock" | "learn" | null;
    learning_module_block_id: string | null;
  } = {
    student_id: student.id,
    student_question_set_attempt_id: setAttemptId,
    student_practice_session_id: practiceSessionId,
    learning_module_block_id: isLearnAttempt
      ? body.learningModuleBlockId!
      : null,
    question_id: body.questionId,
    answer_snapshot: body.answerSnapshot ?? null,
    is_flagged: hasFlag ? (body.isFlagged ?? false) : false,
    is_submitted: isSubmitted,
    time_spent_seconds: null,
    ...(practiceSessionId ? { first_seen_at: new Date().toISOString() } : {}),
    was_timed: body.wasTimed ?? false,
    mode: body.mode ?? null,
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("student_question_attempts")
    .upsert(insertPayload, {
      onConflict: practiceSessionId
        ? "student_practice_session_id,question_id"
        : setAttemptId
          ? "student_question_set_attempt_id,question_id"
          : "id",
    })
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    const quota = parseQuotaExceededMessage(insertError?.message ?? "");
    if (quota) return quotaExceededResponse(quota);
    captureApiError(insertError, "/api/ucat/question-attempts");
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to insert question attempt" },
      { status: 500 },
    );
  }

  const hasAnswer =
    body.submittedByStem === true || body.answerSnapshot != null;
  if (isLearnAttempt && hasAnswer) {
    try {
      const progress = await maybeAutoCompleteQuestionBlock(
        supabaseAdmin,
        student.id,
        body.learningModuleBlockId!,
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
      // Progress update is best-effort; attempt is already saved.
    }
  }

  return NextResponse.json({ id: inserted.id });
}
