import { NextRequest, NextResponse } from "next/server";
import {
  checkQuotaForAction,
  quotaExceededResponse,
} from "@/lib/ucat/quota/quota-service";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import {
  buildAttemptState,
  getActiveAttemptForStudent,
  startSkillTrainerAttempt,
  startSkillTrainerSetAttempt,
} from "@/lib/ucat/skill-trainer/attempt-service";

export async function GET() {
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  try {
    const active = await getActiveAttemptForStudent(auth.admin, auth.studentId);
    if (!active) return NextResponse.json({ attempt: null });
    const state = await buildAttemptState(auth.admin, active);
    return NextResponse.json({ attempt: state });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load attempt" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  const body = (await request.json()) as {
    trainerKey?: string;
    skillTrainerSetId?: string;
    learningModuleBlockId?: string;
  };
  if (!body.trainerKey) {
    return NextResponse.json({ error: "Missing trainerKey" }, { status: 400 });
  }

  try {
    const existing = await getActiveAttemptForStudent(auth.admin, auth.studentId);
    if (existing && !existing.completed_at) {
      const state = await buildAttemptState(auth.admin, existing);
      if (!state.isCompleted) {
        return NextResponse.json({ attempt: state });
      }
    }

    const isLearnContext =
      body.skillTrainerSetId != null && body.learningModuleBlockId != null;

    if (!isLearnContext) {
      const quotaCheck = await checkQuotaForAction(
        auth.admin,
        auth.studentId,
        "skill_trainer",
      );
      if (!quotaCheck.allowed) {
        return quotaExceededResponse(quotaCheck.payload);
      }
    }

    const state = isLearnContext
      ? await startSkillTrainerSetAttempt(
          auth.admin,
          auth.studentId,
          body.trainerKey,
          body.skillTrainerSetId!,
          body.learningModuleBlockId!,
        )
      : await startSkillTrainerAttempt(
          auth.admin,
          auth.studentId,
          body.trainerKey,
        );
    return NextResponse.json({ attempt: state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start attempt";
    if (message === "ANOTHER_ATTEMPT_IN_PROGRESS") {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    if (message === "NO_ITEMS_AVAILABLE") {
      return NextResponse.json({ error: message }, { status: 422 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
