import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { updateStudyPlanTask } from "@/features/study-plan/server/study-plan-service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ taskId: string }> },
) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = (await request.json()) as { action?: unknown };
    if (
      body.action !== "start" &&
      body.action !== "skip" &&
      body.action !== "unskip" &&
      body.action !== "complete"
    ) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
    const { taskId } = await context.params;
    await updateStudyPlanTask(user.id, taskId, body.action);
    return NextResponse.json({ ok: true });
  } catch (error) {
    captureApiError(error, "/api/ucat/study-plan/tasks/[taskId]");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to update Study plan task.",
      },
      { status: 500 },
    );
  }
}
