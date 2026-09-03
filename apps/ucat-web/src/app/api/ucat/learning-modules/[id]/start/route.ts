import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import {
  checkQuotaForAction,
  quotaExceededResponse,
} from "@/lib/ucat/quota/quota-service";
import { ensureLessonStarted } from "@/lib/ucat/learning/progress-service";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as {
    studyPlanTaskId?: unknown;
  };
  const studyPlanTaskId =
    typeof body.studyPlanTaskId === "string" ? body.studyPlanTaskId : null;
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  const { data: lesson, error: lessonError } = await auth.admin
    .from("ucat_learning_modules")
    .select("id, kind")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (lessonError) {
    captureApiError(lessonError, "/api/ucat/learning-modules/[id]/start");
    return NextResponse.json({ error: lessonError.message }, { status: 500 });
  }
  if (!lesson || lesson.kind !== "lesson") {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const quotaCheck = await checkQuotaForAction(
    auth.admin,
    auth.studentId,
    "learn",
    { learningModuleId: id },
  );
  if (!quotaCheck.allowed) {
    return quotaExceededResponse(quotaCheck.payload);
  }

  try {
    const result = await ensureLessonStarted(
      auth.admin,
      auth.studentId,
      id,
      studyPlanTaskId,
    );
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start lesson";
    if (message.startsWith("QUOTA_EXCEEDED:")) {
      return quotaExceededResponse(
        JSON.parse(message.slice("QUOTA_EXCEEDED:".length)),
      );
    }
    captureApiError(error, "/api/ucat/learning-modules/[id]/start");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
