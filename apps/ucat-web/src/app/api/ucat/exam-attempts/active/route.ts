import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getActiveExamAttempt } from "@/lib/ucat/exam-attempt/service";
import { createDiscoveryTiming } from "@/lib/ucat/exam-attempt/discovery-timing";

export const dynamic = "force-dynamic";

export async function GET() {
  const timing = createDiscoveryTiming();
  let response: NextResponse;
  try {
    response = await discover(timing);
  } catch (error) {
    timing.finish(500);
    throw error;
  }
  timing.finish(response.status, response.headers);
  return response;
}

async function discover(timing: ReturnType<typeof createDiscoveryTiming>) {
  const supabase = await timing.measure(
    "server_client",
    getSupabaseServerClient,
  );
  const {
    data: { user },
    error: authError,
  } = await timing.measure("auth", () => supabase.auth.getUser());

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
  const admin = supabaseAdmin;

  const { data: student, error: studentError } = await timing.measure(
    "student",
    () =>
      admin.from("students").select("id").eq("user_id", user.id).maybeSingle(),
  );

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
    const active = await timing.measure("active_resolution", () =>
      getActiveExamAttempt(admin, student.id, {
        readerClient: supabase,
        onSlotTiming: (duration) => timing.record("active_slot", duration),
      }),
    );
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
