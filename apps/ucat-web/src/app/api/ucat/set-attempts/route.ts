import { NextRequest, NextResponse } from "next/server";
import type { TablesInsert } from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  checkQuotaForAction,
  quotaExceededResponse,
} from "@/lib/ucat/quota/quota-service";

type SetAttemptInsert = TablesInsert<"student_question_set_attempts">;

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
    questionSetId: string;
    mockAttemptId?: string | null;
    wasTimed?: boolean;
  };

  if (!body.questionSetId) {
    return NextResponse.json(
      { error: "Missing questionSetId" },
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

  if (!body.mockAttemptId) {
    const quotaCheck = await checkQuotaForAction(
      supabaseAdmin,
      student.id,
      "sets",
    );
    if (!quotaCheck.allowed) {
      return quotaExceededResponse(quotaCheck.payload);
    }
  }

  const insertPayload: SetAttemptInsert = {
    student_id: student.id,
    question_set_id: body.questionSetId,
    student_ucat_mock_attempt_id: body.mockAttemptId ?? null,
    was_timed: body.wasTimed ?? false,
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("student_question_set_attempts")
    .insert(insertPayload)
    .select("id")
    .maybeSingle();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to create set attempt" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: inserted.id });
}
