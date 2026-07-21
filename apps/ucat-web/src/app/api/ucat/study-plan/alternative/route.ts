import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { suggestAlternativeStudyGuidance } from "@/features/study-plan/server/study-plan-service";
import type {
  StudyGuidanceAlternativeInput,
  StudyPlanTaskType,
} from "@/features/study-plan/model/types";

const TASK_TYPES = new Set<StudyPlanTaskType>([
  "learn",
  "skill_trainer",
  "practice",
  "section_benchmark",
  "mock",
  "review",
]);

function parseInput(value: unknown): StudyGuidanceAlternativeInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid alternative request.");
  const record = value as Record<string, unknown>;
  if (
    !Array.isArray(record.excludedKeys) ||
    record.excludedKeys.length > 20 ||
    record.excludedKeys.some(
      (key) => typeof key !== "string" || key.length > 300,
    )
  ) {
    throw new Error("Invalid excluded suggestions.");
  }
  if (
    !Array.isArray(record.currentTaskTypes) ||
    record.currentTaskTypes.length > 6 ||
    record.currentTaskTypes.some(
      (taskType) =>
        typeof taskType !== "string" ||
        !TASK_TYPES.has(taskType as StudyPlanTaskType),
    )
  ) {
    throw new Error("Invalid current activity types.");
  }
  return {
    excludedKeys: [...new Set(record.excludedKeys as string[])],
    currentTaskTypes: [
      ...new Set(record.currentTaskTypes as StudyPlanTaskType[]),
    ],
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw new Error("Failed to get user.");
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const input = parseInput(await request.json());
    return NextResponse.json(
      await suggestAlternativeStudyGuidance(supabase, user.id, input),
    );
  } catch (error) {
    captureApiError(error, "/api/ucat/study-plan/alternative");
    console.error("[study-plan] alternative POST failed", error);
    const message =
      error instanceof Error
        ? error.message
        : "Failed to suggest another activity.";
    const status = message.startsWith("Invalid") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
