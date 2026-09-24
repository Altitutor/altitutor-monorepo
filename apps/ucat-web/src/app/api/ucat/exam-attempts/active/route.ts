import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveExamAttempt } from "@/lib/ucat/exam-attempt/service";

export const dynamic = "force-dynamic";

export async function GET() {
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

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) {
    captureApiError(studentError, "/api/ucat/exam-attempts/active");
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  try {
    const active = await getActiveExamAttempt(supabaseAdmin, student.id, {
      readerClient: supabase,
    });
    return NextResponse.json({ active });
  } catch (error) {
    captureApiError(error, "/api/ucat/exam-attempts/active");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load active exam attempt",
      },
      { status: 500 },
    );
  }
}
