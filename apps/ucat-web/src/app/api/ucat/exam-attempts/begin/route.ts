import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  beginExamAttempt,
  getActiveExamAttempt,
  type StoredExamSnapshot,
} from "@/lib/ucat/exam-attempt/service";
import type { BeginExamAttemptInput } from "@/lib/ucat/exam-attempt/types";
import { quotaExceededResponse } from "@/lib/ucat/quota/quota-service";
import { ServerTiming } from "@/lib/performance/server-timing";
import {
  PRACTICE_SESSION_ENDED_CODE,
  PRACTICE_SESSION_ENDED_MESSAGE,
  PracticeSessionEndedError,
} from "@/lib/ucat/practice-sessions/practice-session-ended";

export async function POST(request: NextRequest) {
  const timing = new ServerTiming();
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  timing.mark("auth");

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
  timing.mark("student");

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

  try {
    const result = await beginExamAttempt(
      supabaseAdmin,
      student.id,
      body,
      body.examMeta,
      body.examTiming,
    );
    timing.mark("begin");
    return timing.apply(
      NextResponse.json({
        attempt: result.attempt,
        resumed: result.resumed,
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to begin";
    if (error instanceof PracticeSessionEndedError) {
      return NextResponse.json(
        {
          code: PRACTICE_SESSION_ENDED_CODE,
          error: PRACTICE_SESSION_ENDED_MESSAGE,
        },
        { status: 410 },
      );
    }
    if (message.startsWith("QUOTA_EXCEEDED:")) {
      const payload = JSON.parse(message.slice("QUOTA_EXCEEDED:".length));
      return quotaExceededResponse(payload);
    }
    if (message.includes("EXAM_ATTEMPT_IN_PROGRESS")) {
      const active = await getActiveExamAttempt(supabaseAdmin, student.id);
      // Two begin requests for the same resource can both pass the initial
      // active-attempt read. The database slot correctly lets only one create
      // the row; treat the loser as an idempotent resume instead of a conflict.
      if (
        active?.kind === body.kind &&
        active.resourceId === body.resourceId &&
        (!body.studyPlanTaskId ||
          active.studyPlanTaskId === body.studyPlanTaskId)
      ) {
        timing.mark("begin_race_resume");
        return timing.apply(
          NextResponse.json({ attempt: active, resumed: true }),
        );
      }
      return NextResponse.json({ error: message, active }, { status: 409 });
    }
    captureApiError(error, "/api/ucat/exam-attempts/begin");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
