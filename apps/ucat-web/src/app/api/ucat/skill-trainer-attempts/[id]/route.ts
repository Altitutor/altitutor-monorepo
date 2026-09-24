import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextResponse } from "next/server";
import { isUcatSkillTrainerKey } from "@altitutor/shared";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import {
  buildAttemptState,
  discardSkillTrainerAttempt,
} from "@/lib/ucat/skill-trainer/attempt-service";

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("student_skill_trainer_attempts")
    .select("*, ucat_skill_trainers(key, is_enabled)")
    .eq("id", params.id)
    .eq("student_id", auth.studentId)
    .is("discarded_at", null)
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
    const trainerKey = trainer.key;
    if (!trainerKey || !isUcatSkillTrainerKey(trainerKey)) {
      throw new Error("INVALID_TRAINER");
    }
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
      discarded_at: data.discarded_at,
      trainer_key: trainerKey,
      version: data.version,
    });
    if (new URL(request.url).searchParams.get("include") === "review") {
      if (!state.isCompleted) {
        return NextResponse.json(
          { error: "Attempt is not complete" },
          { status: 409 },
        );
      }

      const { data: completedItems, error: completedItemsError } =
        await auth.admin
          .from("student_skill_trainer_attempt_items")
          .select(
            "id, skill_trainer_item_id, score_delta, result, completed_at",
          )
          .eq("skill_trainer_attempt_id", state.attempt.id)
          .order("completed_at", { ascending: true });
      if (completedItemsError) throw new Error(completedItemsError.message);

      const itemIds = [
        ...new Set(
          (completedItems ?? []).map((item) => item.skill_trainer_item_id),
        ),
      ];
      const { data: trainerItems, error: trainerItemsError } = itemIds.length
        ? await auth.admin
            .from("ucat_skill_trainer_items")
            .select("id, content")
            .in("id", itemIds)
        : { data: [], error: null };
      if (trainerItemsError) throw new Error(trainerItemsError.message);
      const contentById = new Map(
        (trainerItems ?? []).map((item) => [
          item.id,
          item.content as Record<string, unknown>,
        ]),
      );

      let previousCompletedAt = Date.parse(state.attempt.started_at);
      const reviewItems = (completedItems ?? []).map((item) => {
        const result =
          item.result &&
          typeof item.result === "object" &&
          !Array.isArray(item.result)
            ? (item.result as Record<string, unknown>)
            : {};
        const completedAt = Date.parse(item.completed_at);
        const measuredElapsed =
          Number.isFinite(completedAt) && Number.isFinite(previousCompletedAt)
            ? Math.max(
                0,
                Math.round((completedAt - previousCompletedAt) / 1000),
              )
            : null;
        previousCompletedAt = completedAt;
        const storedElapsed =
          typeof result.elapsed_seconds === "number"
            ? Math.max(0, Math.round(result.elapsed_seconds))
            : null;
        return {
          id: item.id,
          item_id: item.skill_trainer_item_id,
          content: contentById.get(item.skill_trainer_item_id) ?? {},
          score_delta: Number(item.score_delta),
          completed_at: item.completed_at,
          elapsed_seconds: storedElapsed ?? measuredElapsed,
          correct:
            typeof result.correct === "boolean"
              ? result.correct
              : Number(item.score_delta) > 0,
          answer: result.answer ?? null,
        };
      });

      return NextResponse.json({
        review: {
          attempt: {
            id: state.attempt.id,
            score: state.attempt.score,
            started_at: state.attempt.started_at,
            completed_at: state.attempt.completed_at,
            trainer_key: trainerKey,
          },
          items: reviewItems,
        },
      });
    }
    return NextResponse.json({ attempt: state });
  } catch (err) {
    captureApiError(err, "/api/ucat/skill-trainer-attempts/[id]");
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load attempt" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  try {
    const discarded = await discardSkillTrainerAttempt(
      auth.admin,
      params.id,
      auth.studentId,
    );
    if (!discarded) {
      return NextResponse.json(
        { error: "Attempt not found or already finished" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    captureApiError(err, "/api/ucat/skill-trainer-attempts/[id]");
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to discard attempt",
      },
      { status: 500 },
    );
  }
}
