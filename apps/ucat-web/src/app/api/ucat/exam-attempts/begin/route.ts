import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  beginExamAttempt,
  checkExamAttemptConflict,
  resumeExistingExamAttempt,
  type StoredExamSnapshot,
} from "@/lib/ucat/exam-attempt/service";
import type { BeginExamAttemptInput } from "@/lib/ucat/exam-attempt/types";
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

  const body = (await request.json()) as BeginExamAttemptInput & {
    examMeta: StoredExamSnapshot["exam"];
    examTiming?: StoredExamSnapshot["examTiming"];
    resumeOnly?: boolean;
  };

  if (
    !body.kind ||
    !body.resourceId ||
    !body.engineSnapshot ||
    !body.examMeta
  ) {
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
    captureApiError(studentError, "/api/ucat/exam-attempts/begin");
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  if (body.resumeOnly) {
    const existing = await resumeExistingExamAttempt(
      supabaseAdmin,
      student.id,
      body.kind,
      body.resourceId,
    );
    if (existing) {
      return NextResponse.json({ attempt: existing, resumed: true });
    }
  }

  const conflict = await checkExamAttemptConflict(
    supabaseAdmin,
    student.id,
    body.kind,
    body.resourceId,
  );
  if (conflict) {
    return NextResponse.json(
      { error: "EXAM_ATTEMPT_IN_PROGRESS", active: conflict },
      { status: 409 },
    );
  }

  try {
    const result = await beginExamAttempt(
      supabaseAdmin,
      student.id,
      body,
      body.examMeta,
      body.examTiming,
    );
    return NextResponse.json({
      attempt: result.attempt,
      resumed: result.resumed,
    });
  } catch (error) {
    captureApiError(error, "/api/ucat/exam-attempts/begin");
    const message = error instanceof Error ? error.message : "Failed to begin";
    if (message.startsWith("QUOTA_EXCEEDED:")) {
      const payload = JSON.parse(message.slice("QUOTA_EXCEEDED:".length));
      return quotaExceededResponse(payload);
    }
    if (message.includes("EXAM_ATTEMPT_IN_PROGRESS")) {
      const active = await checkExamAttemptConflict(
        supabaseAdmin,
        student.id,
        body.kind,
        body.resourceId,
      );
      return NextResponse.json({ error: message, active }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
