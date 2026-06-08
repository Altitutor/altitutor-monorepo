import { NextRequest, NextResponse } from "next/server";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import {
  submitSkillTrainerAction,
  type SubmitActionPayload,
} from "@/lib/ucat/skill-trainer/attempt-service";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  const payload = (await request.json()) as SubmitActionPayload;

  try {
    const state = await submitSkillTrainerAction(
      auth.admin,
      params.id,
      auth.studentId,
      payload,
    );
    return NextResponse.json({ attempt: state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed";
    if (message === "COOLDOWN_ACTIVE") {
      return NextResponse.json({ error: message }, { status: 429 });
    }
    if (message === "ATTEMPT_NOT_FOUND") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
