import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { discardExamAttempt } from "@/lib/ucat/exam-attempt/service";
import type { ExamAttemptKind } from "@/lib/ucat/exam-attempt/types";
import { captureApiError } from "@/lib/sentry/capture-api-error";

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    kind?: ExamAttemptKind;
    attemptId?: string;
  };
  if (
    !body.kind ||
    !body.attemptId ||
    !["set", "mock", "practice"].includes(body.kind)
  ) {
    return NextResponse.json({ error: "Invalid attempt" }, { status: 400 });
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (studentError || !student) {
    return NextResponse.json(
      { error: studentError?.message ?? "Student not found" },
      { status: studentError ? 500 : 404 },
    );
  }

  try {
    const discarded = await discardExamAttempt(
      supabaseAdmin,
      student.id,
      body.kind,
      body.attemptId,
    );
    return NextResponse.json({ success: true, discarded });
  } catch (error) {
    captureApiError(error, "/api/ucat/exam-attempts/discard");
    return NextResponse.json(
      { error: "Failed to discard attempt" },
      { status: 500 },
    );
  }
}
