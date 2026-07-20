import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import {
  markAllLessonBlocksComplete,
  resetLessonProgress,
} from "@/lib/ucat/learning/progress-service";
import { captureUcatLearningActivityCompletedInBackground } from "@/lib/analytics/posthog-server";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  try {
    const progress = await markAllLessonBlocksComplete(
      auth.admin,
      auth.studentId,
      id,
    );
    if (progress.newlyCompleted) {
      captureUcatLearningActivityCompletedInBackground({
        userId: auth.userId,
        activityType: "lesson",
        activityId: id,
        properties: { completion_source: "lesson_manual" },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    captureApiError(error, "/api/ucat/learning-modules/[id]/complete");
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to complete lesson",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  try {
    await resetLessonProgress(auth.admin, auth.studentId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    captureApiError(error, "/api/ucat/learning-modules/[id]/complete");
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to reset lesson progress",
      },
      { status: 500 },
    );
  }
}
