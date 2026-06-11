import { NextResponse } from "next/server";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import { buildAttemptState } from "@/lib/ucat/skill-trainer/attempt-service";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.admin
    .from("student_skill_trainer_attempts")
    .select("*, ucat_skill_trainers(key)")
    .eq("id", params.id)
    .eq("student_id", auth.studentId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
  }

  try {
    const trainerKey = (data as { ucat_skill_trainers?: { key?: string } }).ucat_skill_trainers?.key;
    const state = await buildAttemptState(
      auth.admin,
      {
        id: data.id,
        student_id: data.student_id,
        skill_trainer_id: data.skill_trainer_id,
        score: Number(data.score),
        streak_count: data.streak_count,
        item_queue_snapshot: Array.isArray(data.item_queue_snapshot)
          ? (data.item_queue_snapshot as string[])
          : [],
        current_item_index: data.current_item_index,
        progress: data.progress as Parameters<typeof buildAttemptState>[1]["progress"],
        config_snapshot: data.config_snapshot as Parameters<typeof buildAttemptState>[1]["config_snapshot"],
        ends_at: data.ends_at,
        started_at: data.started_at,
        completed_at: data.completed_at,
        trainer_key: trainerKey,
      },
    );
    return NextResponse.json({ attempt: state });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load attempt" },
      { status: 500 },
    );
  }
}
