import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { maybeGrantPracticeDayDiscount } from "@/lib/ucat/practice-day-discount";

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
  };

  if (!body.complete) {
    return NextResponse.json(
      { error: "Unsupported operation" },
      { status: 400 },
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

  const sessionId = params.id;

  const { data: session, error: sessionError } = await (
    supabaseAdmin! as {
      from: (
        t: string,
      ) => ReturnType<NonNullable<typeof supabaseAdmin>["from"]>;
    }
  )
    .from("student_practice_sessions")
    .select("id, student_id, completed_at")
    .eq("id", sessionId)
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

  const sessionData = session as { completed_at?: string | null };
  if (sessionData.completed_at) {
    return NextResponse.json(
      { error: "Practice session already completed" },
      { status: 400 },
    );
  }

  const scorePoints = body.scorePoints ?? 0;
  const totalPoints = body.totalPoints ?? 0;
  const questionCount = body.questionCount ?? 0;
  const stemsSnapshot = body.stemsSnapshot ?? null;
  const questionScores = body.questionScores ?? [];

  const { data: attempts, error: attemptsError } = await supabaseAdmin
    .from("student_question_attempts")
    .select("id, question_id, student_id")
    .eq("student_practice_session_id", sessionId)
    .eq("student_id", student.id);

  if (attemptsError) {
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
      score: scoreByQuestionId.get(qa.question_id) ?? 0,
      is_submitted: true,
    }));

    const { error: updateError } = await supabaseAdmin
      .from("student_question_attempts")
      .upsert(updates, { onConflict: "id" });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }
  }

  const { error: updateError } = await (
    supabaseAdmin! as {
      from: (
        t: string,
      ) => ReturnType<NonNullable<typeof supabaseAdmin>["from"]>;
    }
  )
    .from("student_practice_sessions")
    .update({
      completed_at: new Date().toISOString(),
      score_points: scorePoints,
      total_points: totalPoints,
      question_count: questionCount,
      stems_snapshot: stemsSnapshot,
    })
    .eq("id", sessionId)
    .eq("student_id", student.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

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
