import { NextRequest, NextResponse } from "next/server";
import type { Json } from "@altitutor/shared";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import {
  recalculateLessonProgress,
  upsertBlockProgress,
} from "@/lib/ucat/learning/progress-service";

type RouteContext = { params: Promise<{ blockId: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { blockId } = await context.params;
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    interactionState?: Json;
    completed?: boolean;
    manuallyCompleted?: boolean;
  };

  const { data: block, error: blockError } = await auth.admin
    .from("ucat_learning_module_blocks")
    .select("id, learning_module_id")
    .eq("id", blockId)
    .is("deleted_at", null)
    .maybeSingle();

  if (blockError) {
    return NextResponse.json({ error: blockError.message }, { status: 500 });
  }
  if (!block) {
    return NextResponse.json({ error: "Block not found" }, { status: 404 });
  }

  try {
    await upsertBlockProgress(auth.admin, auth.studentId, blockId, body);
    await recalculateLessonProgress(
      auth.admin,
      auth.studentId,
      block.learning_module_id,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update progress" },
      { status: 500 },
    );
  }
}
