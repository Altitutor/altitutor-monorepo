import { NextRequest, NextResponse } from "next/server";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import { markAllLessonBlocksComplete } from "@/lib/ucat/learning/progress-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  try {
    await markAllLessonBlocksComplete(auth.admin, auth.studentId, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to complete lesson" },
      { status: 500 },
    );
  }
}
