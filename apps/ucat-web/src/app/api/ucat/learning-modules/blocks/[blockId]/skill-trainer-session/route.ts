import { NextRequest, NextResponse } from "next/server";
import { isUcatSkillTrainerKey, type SkillTrainerConfigSnapshot } from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { requireStudentAdminClient } from "@/lib/ucat/skill-trainer/api-auth";
import type { SkillTrainerAttemptState } from "@/features/skill-trainer/types/attempt";

type RouteContext = { params: Promise<{ blockId: string }> };

function buildConfigSnapshot(
  configRow: {
    time_limit_seconds: number;
    points_correct: number;
    points_wrong: number;
    streak_multiplier_steps: unknown;
    speed_bonus_enabled?: boolean | null;
    speed_bonus_max_points?: number | null;
    speed_bonus_window_seconds?: number | null;
  },
  trainerKey: SkillTrainerConfigSnapshot["trainer_key"],
): SkillTrainerConfigSnapshot {
  return {
    time_limit_seconds: configRow.time_limit_seconds,
    points_correct: Number(configRow.points_correct),
    points_wrong: Number(configRow.points_wrong),
    streak_enabled: true,
    streak_multiplier_steps:
      (configRow.streak_multiplier_steps ?? []) as SkillTrainerConfigSnapshot["streak_multiplier_steps"],
    speed_bonus_enabled: configRow.speed_bonus_enabled ?? false,
    speed_bonus_max_points: Number(configRow.speed_bonus_max_points ?? 0),
    speed_bonus_window_seconds: Number(configRow.speed_bonus_window_seconds ?? 8),
    trainer_key: trainerKey,
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { blockId } = await context.params;
  const trainerKey = request.nextUrl.searchParams.get("trainerKey");
  const auth = await requireStudentAdminClient();
  if (!auth.ok) return auth.response;

  if (!trainerKey || !isUcatSkillTrainerKey(trainerKey)) {
    return NextResponse.json({ error: "Invalid trainerKey" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const { data: block, error: blockError } = await supabase
    .from("vstudent_ucat_learning_module_blocks")
    .select("id, block_type, skill_trainer_set_id")
    .eq("id", blockId)
    .maybeSingle();

  if (blockError) {
    return NextResponse.json({ error: blockError.message }, { status: 500 });
  }
  if (
    !block ||
    block.block_type !== "skill_trainer_set" ||
    !block.skill_trainer_set_id
  ) {
    return NextResponse.json({ error: "Skill trainer block not found" }, { status: 404 });
  }

  try {
    const { data: trainer, error: trainerError } = await auth.admin
      .from("ucat_skill_trainers")
      .select("id, key, name")
      .eq("key", trainerKey)
      .eq("is_enabled", true)
      .maybeSingle();

    if (trainerError) throw new Error(trainerError.message);
    if (!trainer || !isUcatSkillTrainerKey(trainer.key)) {
      return NextResponse.json({ error: "Trainer not found" }, { status: 404 });
    }

    const { data: setRow, error: setError } = await auth.admin
      .from("ucat_skill_trainer_sets")
      .select("id, name")
      .eq("id", block.skill_trainer_set_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (setError) throw new Error(setError.message);

    const { data: setItems, error: setItemsError } = await auth.admin
      .from("ucat_skill_trainer_set_items")
      .select("skill_trainer_item_id")
      .eq("skill_trainer_set_id", block.skill_trainer_set_id)
      .order("index", { ascending: true });

    if (setItemsError) throw new Error(setItemsError.message);
    const orderedItemIds = (setItems ?? []).map((row) => row.skill_trainer_item_id);
    if (orderedItemIds.length === 0) {
      return NextResponse.json({ error: "NO_ITEMS_AVAILABLE" }, { status: 422 });
    }

    const { data: items, error: itemsError } = await auth.admin
      .from("ucat_skill_trainer_items")
      .select("id, content")
      .eq("skill_trainer_id", trainer.id)
      .eq("is_active", true)
      .eq("approval_status", "approved")
      .is("deleted_at", null)
      .in("id", orderedItemIds);

    if (itemsError) throw new Error(itemsError.message);
    const itemsById = new Map(
      (items ?? []).map((item) => [
        item.id,
        { id: item.id, content: item.content as Record<string, unknown> },
      ]),
    );
    const queue = orderedItemIds.filter((id) => itemsById.has(id));
    if (queue.length === 0) {
      return NextResponse.json({ error: "NO_ITEMS_AVAILABLE" }, { status: 422 });
    }

    const { data: configRow, error: configError } = await auth.admin
      .from("ucat_skill_trainer_config")
      .select("time_limit_seconds, points_correct, points_wrong, streak_multiplier_steps, speed_bonus_enabled, speed_bonus_max_points, speed_bonus_window_seconds")
      .eq("skill_trainer_id", trainer.id)
      .maybeSingle();

    if (configError) throw new Error(configError.message);
    if (!configRow) {
      return NextResponse.json({ error: "Trainer config not found" }, { status: 404 });
    }

    const configSnapshot = buildConfigSnapshot(configRow, trainer.key);
    const startedAt = new Date().toISOString();
    const endsAt = new Date(
      Date.now() + configSnapshot.time_limit_seconds * 1000,
    ).toISOString();

    const state: SkillTrainerAttemptState = {
      attempt: {
        id: `learn-${blockId}`,
        student_id: auth.studentId,
        skill_trainer_id: trainer.id,
        score: 0,
        streak_count: 0,
        item_queue_snapshot: queue,
        current_item_index: 0,
        current_item_started_at: startedAt,
        progress: null,
        config_snapshot: configSnapshot,
        ends_at: endsAt,
        started_at: startedAt,
        completed_at: null,
        trainer_key: trainer.key,
      },
      currentItem: itemsById.get(queue[0]) ?? null,
      nextItem: queue[1] ? itemsById.get(queue[1]) ?? null : null,
      remainingSeconds: configSnapshot.time_limit_seconds,
      isExpired: false,
      isCompleted: false,
    };

    return NextResponse.json({
      session: state,
      items: queue.map((id) => itemsById.get(id)).filter(Boolean),
      trainerName: trainer.name,
      setName: setRow?.name ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load session" },
      { status: 500 },
    );
  }
}
