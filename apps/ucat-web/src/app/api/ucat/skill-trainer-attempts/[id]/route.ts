import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextResponse } from "next/server";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import {
  buildAttemptState,
  completeSkillTrainerAttempt,
} from "@/lib/ucat/skill-trainer/attempt-service";
import { captureUcatLearningActivityCompleted } from "@/lib/analytics/posthog-server";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("student_skill_trainer_attempts")
    .select("*, ucat_skill_trainers(key, is_enabled)")
    .eq("id", params.id)
    .eq("student_id", auth.studentId)
    .maybeSingle();

  if (error) {
    captureApiError(error, "/api/ucat/skill-trainer-attempts/[id]");
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  const trainer = (
    data as {
      ucat_skill_trainers?: {
        key?: string | null;
        is_enabled?: boolean | null;
      } | null;
    }
  ).ucat_skill_trainers;
  if (trainer?.is_enabled !== true) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  try {
    const trainerKey = trainer.key ?? undefined;
    const state = await buildAttemptState(auth.admin, {
      id: data.id,
      student_id: data.student_id,
      skill_trainer_id: data.skill_trainer_id,
      score: Number(data.score),
      streak_count: data.streak_count,
      item_queue_snapshot: Array.isArray(data.item_queue_snapshot)
        ? (data.item_queue_snapshot as string[])
        : [],
      current_item_index: data.current_item_index,
      current_item_started_at: data.current_item_started_at,
      progress: data.progress as Parameters<
        typeof buildAttemptState
      >[1]["progress"],
      config_snapshot: data.config_snapshot as Parameters<
        typeof buildAttemptState
      >[1]["config_snapshot"],
      ends_at: data.ends_at,
      started_at: data.started_at,
      completed_at: data.completed_at,
      trainer_key: trainerKey,
    });
    return NextResponse.json({ attempt: state });
  } catch (err) {
    captureApiError(err, "/api/ucat/skill-trainer-attempts/[id]");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load attempt" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => ({}))) as {
    complete?: boolean;
  };
  if (!body.complete) {
    return NextResponse.json({ error: "Unsupported update" }, { status: 400 });
  }

  try {
    const completion = await completeSkillTrainerAttempt(
      auth.admin,
      params.id,
      auth.studentId,
    );
    if (completion.newlyCompleted) {
      await captureUcatLearningActivityCompleted({
        userId: auth.userId,
        activityType: "skill_trainer",
        activityId: params.id,
        properties: {
          completion_source: "skill_trainer",
          trainer_key: completion.state.attempt.trainer_key ?? null,
        },
      });
    }
    return NextResponse.json({ attempt: completion.state });
  } catch (err) {
    captureApiError(err, "/api/ucat/skill-trainer-attempts/[id]");
    const message =
      err instanceof Error ? err.message : "Failed to update attempt";
    return NextResponse.json(
      { error: message },
      {
        status:
          message === "ATTEMPT_NOT_FOUND" || message === "TRAINER_NOT_FOUND"
            ? 404
            : 500,
      },
    );
  }
}
