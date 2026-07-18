import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import {
  checkQuotaForAction,
  quotaExceededResponse,
} from "@/lib/ucat/quota/quota-service";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import {
  discardSkillTrainerAttempt,
  getUnfinishedSkillTrainerAttempt,
  startSkillTrainerAttempt,
} from "@/lib/ucat/skill-trainer/attempt-service";
import { ServerTiming } from "@/lib/performance/server-timing";

export async function POST(request: NextRequest) {
  const timing = new ServerTiming();
  const auth = await requireStudentAdminClient();
  timing.mark("auth");
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    trainerKey?: string;
  };
  if (!body.trainerKey) {
    return NextResponse.json({ error: "Missing trainerKey" }, { status: 400 });
  }

  try {
    const existing = await getUnfinishedSkillTrainerAttempt(
      auth.admin,
      auth.studentId,
    );
    timing.mark("active");
    if (existing && !existing.completed_at) {
      await discardSkillTrainerAttempt(auth.admin, existing.id, auth.studentId);
      timing.mark("discard-active");
    }

    const { data: trainer, error: trainerError } = await auth.admin
      .from("ucat_skill_trainers")
      .select("id")
      .eq("key", body.trainerKey)
      .eq("is_enabled", true)
      .maybeSingle();
    if (trainerError) throw new Error(trainerError.message);

    const quotaCheck = await checkQuotaForAction(
      auth.admin,
      auth.studentId,
      "skill_trainer",
      { skillTrainerId: trainer?.id },
    );
    timing.mark("quota");
    if (!quotaCheck.allowed) {
      return quotaExceededResponse(quotaCheck.payload);
    }

    const state = await startSkillTrainerAttempt(
      auth.admin,
      auth.studentId,
      body.trainerKey,
    );
    timing.mark("start");
    return timing.apply(NextResponse.json({ attempt: state }));
  } catch (error) {
    captureApiError(error, "/api/ucat/skill-trainer-attempts");
    const message =
      error instanceof Error ? error.message : "Failed to start attempt";
    if (message === "ANOTHER_ATTEMPT_IN_PROGRESS") {
      return NextResponse.json(
        { error: "Please try starting the trainer again" },
        { status: 409 },
      );
    }
    if (message === "NO_ITEMS_AVAILABLE") {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    return NextResponse.json(
      { error: message },
      { status: message === "TRAINER_NOT_FOUND" ? 404 : 500 },
    );
  }
}
