import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import {
  recalculateLessonProgress,
  upsertBlockProgress,
} from "@/lib/ucat/learning/progress-service";
import { captureUcatLearningActivityCompleted } from "@/lib/analytics/posthog-server";

type RouteContext = { params: Promise<{ blockId: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { blockId } = await context.params;
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  const { data: block, error: blockError } = await auth.admin
    .from("ucat_learning_module_blocks")
    .select("id, learning_module_id")
    .eq("id", blockId)
    .is("deleted_at", null)
    .maybeSingle();

  if (blockError) {
    captureApiError(
      blockError,
      "/api/ucat/learning-modules/blocks/[blockId]/complete",
    );
    return NextResponse.json({ error: blockError.message }, { status: 500 });
  }
  if (!block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  try {
    await upsertBlockProgress(auth.admin, auth.studentId, blockId, {
      manuallyCompleted: true,
      completed: true,
    });
    const progress = await recalculateLessonProgress(
      auth.admin,
      auth.studentId,
      block.learning_module_id,
    );
    if (progress.newlyCompleted) {
      await captureUcatLearningActivityCompleted({
        userId: auth.userId,
        activityType: "lesson",
        activityId: block.learning_module_id,
        properties: { completion_source: "lesson_block_manual" },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    captureApiError(
      error,
      "/api/ucat/learning-modules/blocks/[blockId]/complete",
    );
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to mark block complete",
      },
      { status: 500 },
    );
  }
}
