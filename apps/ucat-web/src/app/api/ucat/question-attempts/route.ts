import { NextRequest, NextResponse } from "next/server";
import type { Json } from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  checkQuotaForAction,
  quotaExceededResponse,
} from "@/lib/ucat/quota/quota-service";

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
    questionAnswerOptionId: string | null;
    answerSnapshot?: Json | null;
    timeSpentSeconds?: number | null;
    isFlagged?: boolean;
    wasTimed?: boolean;
    mode?: "question" | "question_stem" | "set" | "mock";
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

  const isPracticeAttempt =
    body.studentPracticeSessionId != null &&
    body.studentPracticeSessionId !== "" &&
    body.studentQuestionSetAttemptId === null;

  if (isPracticeAttempt) {
    const hasAnswer =
      body.questionAnswerOptionId != null || body.answerSnapshot != null;
    const quotaCheck = await checkQuotaForAction(
      supabaseAdmin,
      student.id,
      "practice",
      { practiceQuestionId: body.questionId, hasAnswer },
    );
    if (!quotaCheck.allowed) {
      return quotaExceededResponse(quotaCheck.payload);
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
  } else if (body.studentQuestionSetAttemptId === null) {
    query = query
      .is("student_question_set_attempt_id", null)
      .is("student_practice_session_id", null);
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
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  const hasTime =
    typeof body.timeSpentSeconds === "number" && body.timeSpentSeconds > 0;
  const hasFlag = typeof body.isFlagged === "boolean";

  if (existing) {
    const updatePayload: {
      question_answer_option_id: string | null;
      answer_snapshot: Json | null;
      is_submitted: boolean;
      time_spent_seconds?: number | null;
      is_flagged?: boolean;
      was_timed?: boolean;
      mode?: "question" | "question_stem" | "set" | "mock";
    } = {
      question_answer_option_id: body.questionAnswerOptionId,
      answer_snapshot: body.answerSnapshot ?? null,
      is_submitted: false,
    };

    if (hasTime) {
      updatePayload.time_spent_seconds = body.timeSpentSeconds ?? null;
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
      return NextResponse.json({ error: updateError.message }, { status: 500 });
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
    question_answer_option_id: string | null;
    answer_snapshot: Json | null;
    is_flagged: boolean;
    is_submitted: boolean;
    time_spent_seconds: number | null;
    was_timed: boolean;
    mode: "question" | "question_stem" | "set" | "mock" | null;
  } = {
    student_id: student.id,
    student_question_set_attempt_id: setAttemptId,
    student_practice_session_id: practiceSessionId,
    question_id: body.questionId,
    question_answer_option_id: body.questionAnswerOptionId,
    answer_snapshot: body.answerSnapshot ?? null,
    is_flagged: hasFlag ? (body.isFlagged ?? false) : false,
    is_submitted: false,
    time_spent_seconds: hasTime ? (body.timeSpentSeconds ?? null) : null,
    was_timed: body.wasTimed ?? false,
    mode: body.mode ?? null,
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("student_question_attempts")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to insert question attempt" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: inserted.id });
}
