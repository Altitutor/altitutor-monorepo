import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { PracticeSelectionInput } from "@/features/practice/model/types";
import { quotaExceededResponse } from "@/lib/ucat/quota/quota-service";
import { QuotaExceededError } from "@/lib/ucat/quota/parse-quota-error";
import {
  preparePracticeStems,
  PracticeStemSelectionError,
} from "@/features/practice/server/prepare-practice-stems";

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

  let body: { input?: PracticeSelectionInput };
  try {
    body = (await request.json()) as { input?: PracticeSelectionInput };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = body.input;

  if (!input?.section) {
    return NextResponse.json(
      { error: "A section must be selected." },
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

  try {
    return NextResponse.json(
      await preparePracticeStems({
        reader: supabase,
        admin: supabaseAdmin,
        studentId: student.id,
        input,
      }),
    );
  } catch (error) {
    captureApiError(error, "/api/ucat/practice-stems");
    if (error instanceof QuotaExceededError) {
      return quotaExceededResponse(error.payload);
    }
    if (error instanceof PracticeStemSelectionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load stems",
      },
      { status: 500 },
    );
  }
}
