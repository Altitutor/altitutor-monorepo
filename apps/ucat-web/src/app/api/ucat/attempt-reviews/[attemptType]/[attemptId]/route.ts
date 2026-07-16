import { NextRequest, NextResponse } from "next/server";
import {
  startAttemptReview,
  updateAttemptReview,
} from "@/features/progress/server/attempt-review-service";
import type { AttemptReviewType } from "@/features/progress/model/attempt-review";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const ATTEMPT_TYPES = new Set<AttemptReviewType>([
  "practice_session",
  "set_attempt",
  "mock_attempt",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authenticatedUserId() {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

async function params(context: {
  params: Promise<{ attemptType: string; attemptId: string }>;
}) {
  const value = await context.params;
  if (
    !ATTEMPT_TYPES.has(value.attemptType as AttemptReviewType) ||
    !UUID_PATTERN.test(value.attemptId)
  )
    return null;
  return { ...value, attemptType: value.attemptType as AttemptReviewType };
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ attemptType: string; attemptId: string }> },
) {
  try {
    const userId = await authenticatedUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const route = await params(context);
    if (!route)
      return NextResponse.json(
        { error: "Invalid attempt type" },
        { status: 400 },
      );
    const body = (await request.json()) as { requiredQuestionIds?: unknown };
    if (
      !Array.isArray(body.requiredQuestionIds) ||
      body.requiredQuestionIds.length > 300 ||
      !body.requiredQuestionIds.every(
        (id) => typeof id === "string" && UUID_PATTERN.test(id),
      )
    ) {
      return NextResponse.json(
        { error: "Invalid question ids" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      await startAttemptReview(
        userId,
        route.attemptType,
        route.attemptId,
        body.requiredQuestionIds,
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not start review.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ attemptType: string; attemptId: string }> },
) {
  try {
    const userId = await authenticatedUserId();
    if (!userId)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const route = await params(context);
    if (!route)
      return NextResponse.json(
        { error: "Invalid attempt type" },
        { status: 400 },
      );
    const body = (await request.json()) as {
      action?: unknown;
      questionId?: unknown;
    };
    if (
      body.action !== "complete" &&
      !(
        body.action === "view" &&
        typeof body.questionId === "string" &&
        UUID_PATTERN.test(body.questionId)
      )
    ) {
      return NextResponse.json(
        { error: "Invalid review action" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      await updateAttemptReview(
        userId,
        route.attemptType,
        route.attemptId,
        body.action === "view"
          ? { action: "view", questionId: body.questionId as string }
          : { action: "complete" },
      ),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update review.",
      },
      { status: 500 },
    );
  }
}
