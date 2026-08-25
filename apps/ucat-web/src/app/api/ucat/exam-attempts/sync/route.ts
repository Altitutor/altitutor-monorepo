import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  syncExamAttempt,
  type StoredExamSnapshot,
} from "@/lib/ucat/exam-attempt/service";
import type { SyncExamAttemptInput } from "@/lib/ucat/exam-attempt/types";
import {
  PRACTICE_SESSION_ENDED_CODE,
  PRACTICE_SESSION_ENDED_MESSAGE,
  PracticeSessionEndedError,
} from "@/lib/ucat/practice-sessions/practice-session-ended";
import { parseQuotaExceededMessage } from "@/lib/ucat/quota/parse-quota-error";
import { quotaExceededResponse } from "@/lib/ucat/quota/quota-service";

export async function PATCH(request: NextRequest) {
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

  const body = (await request.json()) as SyncExamAttemptInput & {
    examMeta?: StoredExamSnapshot["exam"];
    examTiming?: StoredExamSnapshot["examTiming"];
    mockAttemptId?: string | null;
  };

  if (!body.kind || !body.attemptId || !body.engineSnapshot) {
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
    captureApiError(studentError, "/api/ucat/exam-attempts/sync");
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  let result: Awaited<ReturnType<typeof syncExamAttempt>>;
  try {
    result = await syncExamAttempt(
      supabaseAdmin,
      student.id,
      body,
      body.examMeta,
      body.mockAttemptId,
      body.examTiming,
    );
  } catch (error) {
    if (error instanceof PracticeSessionEndedError) {
      return NextResponse.json(
        {
          code: PRACTICE_SESSION_ENDED_CODE,
          error: PRACTICE_SESSION_ENDED_MESSAGE,
        },
        { status: 410 },
      );
    }
    const message = error instanceof Error ? error.message : "Failed to sync";
    const quota = parseQuotaExceededMessage(message);
    if (quota) return quotaExceededResponse(quota);
    captureApiError(error, "/api/ucat/exam-attempts/sync");
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ success: true, ...result });
}
