import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { quotaExceededResponse } from "@/lib/ucat/quota/quota-service";
import { requireUserAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import { startSkillTrainerAttempt } from "@/lib/ucat/skill-trainer/attempt-service";
import { ServerTiming } from "@/lib/performance/server-timing";

export async function POST(request: NextRequest) {
  const timing = new ServerTiming();
  const auth = await requireUserAdminClient();
  timing.mark("auth");
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    trainerKey?: string;
  };
  if (!body.trainerKey) {
    return NextResponse.json({ error: "Missing trainerKey" }, { status: 400 });
  }

  try {
    const result = await startSkillTrainerAttempt(
      auth.admin,
      auth.userId,
      body.trainerKey,
    );
    timing.mark("start");
    // Keep this structured timing log until production latency has been validated.
    // eslint-disable-next-line no-console
    console.info("[performance] skill-trainer-start", timing.snapshot());
    if (!result.started) {
      return timing.apply(quotaExceededResponse(result.quota));
    }
    return timing.apply(NextResponse.json({ attempt: result.state }));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start attempt";
    if (message === "NO_ITEMS_AVAILABLE") {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    if (message === "TRAINER_NOT_FOUND" || message === "STUDENT_NOT_FOUND") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    captureApiError(error, "/api/ucat/skill-trainer-attempts");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
