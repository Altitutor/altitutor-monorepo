import { NextRequest, NextResponse } from "next/server";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import {
  submitSkillTrainerAction,
  type SubmitActionPayload,
} from "@/lib/ucat/skill-trainer/attempt-service";
import { ServerTiming } from "@/lib/performance/server-timing";
import { waitUntil } from "@vercel/functions";
import { processPendingPreparationRefreshes } from "@/features/preparation/server/preparation-refresh-worker";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const actionReceivedAt = new Date();
  const timing = new ServerTiming();
  const auth = await requireStudentAdminClient();
  timing.mark("auth");
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    actionId?: string;
    expectedVersion?: number;
    action?: SubmitActionPayload;
  };
  if (
    !body.actionId ||
    !body.action ||
    !Number.isSafeInteger(body.expectedVersion) ||
    (body.expectedVersion ?? -1) < 0
  ) {
    return NextResponse.json(
      { error: "INVALID_ACTION_REQUEST" },
      { status: 400 },
    );
  }

  try {
    const state = await submitSkillTrainerAction(
      auth.admin,
      params.id,
      auth.studentId,
      body.action,
      body.actionId,
      body.expectedVersion as number,
      actionReceivedAt,
    );
    if (state.isCompleted) {
      waitUntil(
        processPendingPreparationRefreshes({
          studentId: auth.studentId,
          limit: 1,
        }),
      );
    }
    timing.mark("action");
    return timing.apply(NextResponse.json({ attempt: state }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed";
    if (message === "ATTEMPT_NOT_FOUND" || message === "TRAINER_NOT_FOUND") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === "STALE_ATTEMPT") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
