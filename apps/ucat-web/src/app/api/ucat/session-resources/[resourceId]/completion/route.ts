import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ resourceId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const { resourceId } = await context.params;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  const { data: resource, error: resourceError } = await supabase
    .from("vstudent_ucat_sessions_resources")
    .select("id, question_stem_id")
    .eq("id", resourceId)
    .maybeSingle();
  if (resourceError) {
    captureApiError(
      resourceError,
      "/api/ucat/session-resources/[resourceId]/completion",
    );
    return NextResponse.json(
      { error: "Failed to verify resource" },
      { status: 500 },
    );
  }
  if (!resource?.id || !resource.question_stem_id) {
    return NextResponse.json(
      { error: "Question stem resource not found" },
      { status: 404 },
    );
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (studentError || !student) {
    return NextResponse.json(
      { error: "Student not found" },
      { status: studentError ? 500 : 404 },
    );
  }

  const { data, error } = await supabaseAdmin
    .from("ucat_student_session_resource_progress")
    .upsert(
      {
        student_id: student.id,
        session_resource_id: resourceId,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "student_id,session_resource_id" },
    )
    .select("completed_at")
    .single();
  if (error) {
    captureApiError(
      error,
      "/api/ucat/session-resources/[resourceId]/completion",
    );
    return NextResponse.json(
      { error: "Failed to save completion" },
      { status: 500 },
    );
  }

  return NextResponse.json({ completedAt: data.completed_at });
}
