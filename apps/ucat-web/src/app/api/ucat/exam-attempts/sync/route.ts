import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  syncExamAttempt,
  type StoredExamSnapshot,
} from "@/lib/ucat/exam-attempt/service";
import type { SyncExamAttemptInput } from "@/lib/ucat/exam-attempt/types";

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
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  const result = await syncExamAttempt(
    supabaseAdmin,
    student.id,
    body,
    body.examMeta,
    body.mockAttemptId,
    body.examTiming,
  );

  return NextResponse.json({ success: true, ...result });
}
