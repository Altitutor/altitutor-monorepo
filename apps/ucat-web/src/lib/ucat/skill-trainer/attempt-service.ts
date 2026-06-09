import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@altitutor/shared";
import type {
  CalculatorMathsItemContent,
  FindConceptItemContent,
  FindWordItemContent,
  MentalMathsItemContent,
  NumpadSpeedItemContent,
  QuickSyllogismItemContent,
  SkillTrainerAttemptProgress,
  SkillTrainerConfigSnapshot,
  UcatSkillTrainerKey,
} from "@altitutor/shared";
import { isUcatSkillTrainerKey } from "@altitutor/shared";
import type {
  SkillTrainerAttemptState,
  SubmitActionPayload,
} from "@/features/skill-trainer/types/attempt";
import { advanceQueue, buildItemQueue } from "@/lib/ucat/skill-trainer/queue";

export type { SkillTrainerAttemptState, SubmitActionPayload };
import {
  applyCorrectScore,
  applyWrongScore,
  normalizeScoreDelta,
  scoreMentalMathsItem,
  scoreNumpadItem,
} from "@/lib/ucat/skill-trainer/scoring";

type AdminClient = SupabaseClient<Database>;

type AttemptRow = {
  id: string;
  student_id: string;
  skill_trainer_id: string;
  score: number;
  streak_count: number;
  item_queue_snapshot: string[];
  current_item_index: number;
  progress: SkillTrainerAttemptProgress | null;
  config_snapshot: SkillTrainerConfigSnapshot;
  ends_at: string;
  started_at: string;
  completed_at: string | null;
  trainer_key?: string;
};

type ItemRow = {
  id: string;
  content: Record<string, unknown>;
};

function parseQueue(snapshot: unknown): string[] {
  if (!Array.isArray(snapshot)) return [];
  return snapshot.filter((id): id is string => typeof id === "string");
}

function parseConfig(snapshot: unknown, trainerKey: UcatSkillTrainerKey): SkillTrainerConfigSnapshot {
  const raw = (snapshot ?? {}) as Partial<SkillTrainerConfigSnapshot>;
  return {
    time_limit_seconds: raw.time_limit_seconds ?? 60,
    wrong_cooldown_seconds: raw.wrong_cooldown_seconds ?? 2,
    points_correct: raw.points_correct ?? 10,
    points_wrong: raw.points_wrong ?? 5,
    streak_enabled: raw.streak_enabled ?? true,
    streak_multiplier_steps: raw.streak_multiplier_steps ?? [
      { min_streak: 3, multiplier: 1.5 },
      { min_streak: 5, multiplier: 2 },
    ],
    trainer_key: trainerKey,
  };
}

function buildConfigSnapshot(
  configRow: {
    time_limit_seconds: number;
    wrong_cooldown_seconds: number;
    points_correct: number;
    points_wrong: number;
    streak_enabled: boolean;
    streak_multiplier_steps: unknown;
  },
  trainerKey: UcatSkillTrainerKey,
): SkillTrainerConfigSnapshot {
  return {
    time_limit_seconds: configRow.time_limit_seconds,
    wrong_cooldown_seconds: configRow.wrong_cooldown_seconds,
    points_correct: Number(configRow.points_correct),
    points_wrong: Number(configRow.points_wrong),
    // All trainer types use streak scoring; multiplier steps still come from admin config.
    streak_enabled: true,
    streak_multiplier_steps: (configRow.streak_multiplier_steps ?? []) as SkillTrainerConfigSnapshot["streak_multiplier_steps"],
    trainer_key: trainerKey,
  };
}

function defaultProgress(trainerKey: UcatSkillTrainerKey): SkillTrainerAttemptProgress {
  switch (trainerKey) {
    case "find_word":
      return { type: "find_word", placed_keyword_ids: [] };
    case "find_concept":
      return { type: "find_concept", found_occurrence_indexes: [] };
    case "quick_syllogism":
      return { type: "quick_syllogism" };
    case "mental_maths":
      return { type: "mental_maths" };
    case "numpad_speed":
      return { type: "numpad_speed" };
    case "calculator_maths":
      return { type: "calculator_maths" };
  }
}

export function getRemainingSeconds(endsAt: string, now = new Date()): number {
  const ms = new Date(endsAt).getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 1000));
}

export async function finalizeAttemptIfExpired(
  supabase: AdminClient,
  attempt: AttemptRow,
): Promise<AttemptRow> {
  if (attempt.completed_at) return attempt;
  if (getRemainingSeconds(attempt.ends_at) > 0) return attempt;

  const { data, error } = await supabase
    .from("student_skill_trainer_attempts")
    .update({
      completed_at: new Date().toISOString(),
      progress: null,
    })
    .eq("id", attempt.id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mapAttemptRow(data ?? attempt, attempt.trainer_key);
}

function mapAttemptRow(
  row: Record<string, unknown>,
  trainerKey?: string,
): AttemptRow {
  let key: UcatSkillTrainerKey = "find_word";
  if (trainerKey && isUcatSkillTrainerKey(trainerKey)) {
    key = trainerKey;
  }
  return {
    id: row.id as string,
    student_id: row.student_id as string,
    skill_trainer_id: row.skill_trainer_id as string,
    score: Number(row.score),
    streak_count: Number(row.streak_count),
    item_queue_snapshot: parseQueue(row.item_queue_snapshot),
    current_item_index: Number(row.current_item_index),
    progress: (row.progress as SkillTrainerAttemptProgress | null) ?? null,
    config_snapshot: parseConfig(row.config_snapshot, key),
    ends_at: row.ends_at as string,
    started_at: row.started_at as string,
    completed_at: (row.completed_at as string | null) ?? null,
    trainer_key: trainerKey,
  };
}

async function loadTrainerByKey(
  supabase: AdminClient,
  trainerKey: string,
): Promise<{ id: string; key: UcatSkillTrainerKey } | null> {
  if (!isUcatSkillTrainerKey(trainerKey)) return null;
  const { data, error } = await supabase
    .from("ucat_skill_trainers")
    .select("id, key")
    .eq("key", trainerKey)
    .eq("is_enabled", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !isUcatSkillTrainerKey(data.key)) return null;
  return { id: data.id, key: data.key };
}

async function loadApprovedItemIds(
  supabase: AdminClient,
  skillTrainerId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("ucat_skill_trainer_items")
    .select("id")
    .eq("skill_trainer_id", skillTrainerId)
    .eq("is_active", true)
    .eq("approval_status", "approved")
    .is("deleted_at", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id);
}

async function loadItem(
  supabase: AdminClient,
  itemId: string,
): Promise<ItemRow | null> {
  const { data, error } = await supabase
    .from("ucat_skill_trainer_items")
    .select("id, content")
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: data.id, content: data.content as Record<string, unknown> };
}

export async function getActiveAttemptForStudent(
  supabase: AdminClient,
  studentId: string,
): Promise<AttemptRow | null> {
  const { data, error } = await supabase
    .from("student_skill_trainer_attempts")
    .select("*, ucat_skill_trainers(key)")
    .eq("student_id", studentId)
    .is("completed_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const trainerKey = (data as { ucat_skill_trainers?: { key?: string } }).ucat_skill_trainers?.key;
  const attempt = mapAttemptRow(data as Record<string, unknown>, trainerKey);

  return finalizeAttemptIfExpired(supabase, attempt);
}

export async function buildAttemptState(
  supabase: AdminClient,
  attempt: AttemptRow,
): Promise<SkillTrainerAttemptState> {
  const finalized = await finalizeAttemptIfExpired(supabase, attempt);
  const queue = parseQueue(finalized.item_queue_snapshot);
  const currentItemId = queue[finalized.current_item_index] ?? null;
  const currentItem = currentItemId ? await loadItem(supabase, currentItemId) : null;
  const remainingSeconds = getRemainingSeconds(finalized.ends_at);
  const isExpired = remainingSeconds <= 0;
  const isCompleted = finalized.completed_at != null || isExpired;

  return {
    attempt: {
      ...finalized,
      item_queue_snapshot: queue,
    },
    currentItem,
    remainingSeconds,
    isExpired,
    isCompleted,
  };
}

async function loadSetItemIds(
  supabase: AdminClient,
  setId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("ucat_skill_trainer_set_items")
    .select("skill_trainer_item_id")
    .eq("skill_trainer_set_id", setId)
    .order("index", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.skill_trainer_item_id);
}

export async function startSkillTrainerSetAttempt(
  supabase: AdminClient,
  studentId: string,
  trainerKey: string,
  skillTrainerSetId: string,
  learningModuleBlockId: string,
): Promise<SkillTrainerAttemptState> {
  const existing = await getActiveAttemptForStudent(supabase, studentId);
  if (existing && !existing.completed_at && getRemainingSeconds(existing.ends_at) > 0) {
    return buildAttemptState(supabase, existing);
  }

  const trainer = await loadTrainerByKey(supabase, trainerKey);
  if (!trainer) throw new Error("TRAINER_NOT_FOUND");

  const itemIds = await loadSetItemIds(supabase, skillTrainerSetId);
  if (itemIds.length === 0) throw new Error("NO_ITEMS_AVAILABLE");

  const { data: configRow, error: configError } = await supabase
    .from("ucat_skill_trainer_config")
    .select("*")
    .eq("skill_trainer_id", trainer.id)
    .maybeSingle();
  if (configError) throw new Error(configError.message);
  if (!configRow) throw new Error("TRAINER_CONFIG_NOT_FOUND");

  const configSnapshot = buildConfigSnapshot(configRow, trainer.key);

  const endsAt = new Date(Date.now() + configSnapshot.time_limit_seconds * 1000).toISOString();

  const { data: inserted, error: insertError } = await supabase
    .from("student_skill_trainer_attempts")
    .insert({
      student_id: studentId,
      skill_trainer_id: trainer.id,
      item_queue_snapshot: itemIds,
      current_item_index: 0,
      progress: defaultProgress(trainer.key),
      config_snapshot: configSnapshot,
      ends_at: endsAt,
      learning_module_block_id: learningModuleBlockId,
      skill_trainer_set_id: skillTrainerSetId,
    })
    .select("*")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") throw new Error("ANOTHER_ATTEMPT_IN_PROGRESS");
    throw new Error(insertError.message);
  }
  if (!inserted) throw new Error("FAILED_TO_START");

  const attempt = mapAttemptRow(
    { ...(inserted as Record<string, unknown>), item_queue_snapshot: itemIds, config_snapshot: configSnapshot },
    trainer.key,
  );

  return buildAttemptState(supabase, attempt);
}

export async function startSkillTrainerAttempt(
  supabase: AdminClient,
  studentId: string,
  trainerKey: string,
): Promise<SkillTrainerAttemptState> {
  const existing = await getActiveAttemptForStudent(supabase, studentId);
  if (existing && !existing.completed_at && getRemainingSeconds(existing.ends_at) > 0) {
    if (existing.trainer_key !== trainerKey) {
      throw new Error("ANOTHER_ATTEMPT_IN_PROGRESS");
    }
    return buildAttemptState(supabase, existing);
  }

  const trainer = await loadTrainerByKey(supabase, trainerKey);
  if (!trainer) throw new Error("TRAINER_NOT_FOUND");

  const itemIds = await loadApprovedItemIds(supabase, trainer.id);
  if (itemIds.length === 0) throw new Error("NO_ITEMS_AVAILABLE");

  const { data: configRow, error: configError } = await supabase
    .from("ucat_skill_trainer_config")
    .select("*")
    .eq("skill_trainer_id", trainer.id)
    .maybeSingle();
  if (configError) throw new Error(configError.message);
  if (!configRow) throw new Error("TRAINER_CONFIG_NOT_FOUND");

  const configSnapshot = buildConfigSnapshot(configRow, trainer.key);

  const endsAt = new Date(Date.now() + configSnapshot.time_limit_seconds * 1000).toISOString();
  const queue = buildItemQueue(itemIds);

  const { data: inserted, error: insertError } = await supabase
    .from("student_skill_trainer_attempts")
    .insert({
      student_id: studentId,
      skill_trainer_id: trainer.id,
      item_queue_snapshot: queue,
      current_item_index: 0,
      progress: defaultProgress(trainer.key),
      config_snapshot: configSnapshot,
      ends_at: endsAt,
    })
    .select("*")
    .maybeSingle();

  if (insertError) {
    if (insertError.code === "23505") throw new Error("ANOTHER_ATTEMPT_IN_PROGRESS");
    throw new Error(insertError.message);
  }
  if (!inserted) throw new Error("FAILED_TO_START");

  const attempt = mapAttemptRow(
    { ...(inserted as Record<string, unknown>), item_queue_snapshot: queue, config_snapshot: configSnapshot },
    trainer.key,
  );

  return buildAttemptState(supabase, attempt);
}

function isInCooldown(progress: SkillTrainerAttemptProgress | null): boolean {
  if (!progress || !("cooldown_until" in progress) || !progress.cooldown_until) return false;
  return new Date(progress.cooldown_until).getTime() > Date.now();
}

function setCooldown(
  progress: SkillTrainerAttemptProgress,
  cooldownSeconds: number,
): SkillTrainerAttemptProgress {
  const until = new Date(Date.now() + cooldownSeconds * 1000).toISOString();
  return { ...progress, cooldown_until: until };
}

async function completeCurrentItem(
  supabase: AdminClient,
  attempt: AttemptRow,
  itemId: string,
  scoreDelta: number,
  result: Record<string, unknown>,
  allItemIds: string[],
): Promise<AttemptRow> {
  await supabase.from("student_skill_trainer_attempt_items").insert({
    skill_trainer_attempt_id: attempt.id,
    skill_trainer_item_id: itemId,
    score_delta: scoreDelta,
    result: result as Json,
  });

  const newScore = Number(attempt.score) + scoreDelta;
  const { queue, currentIndex } = advanceQueue(
    parseQueue(attempt.item_queue_snapshot),
    attempt.current_item_index,
    allItemIds,
    itemId,
  );

  const trainerKey = attempt.config_snapshot.trainer_key;
  const { data, error } = await supabase
    .from("student_skill_trainer_attempts")
    .update({
      score: newScore,
      streak_count: attempt.streak_count,
      item_queue_snapshot: queue,
      current_item_index: currentIndex,
      progress: defaultProgress(trainerKey),
    })
    .eq("id", attempt.id)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return mapAttemptRow(data as Record<string, unknown>, trainerKey);
}

export async function submitSkillTrainerAction(
  supabase: AdminClient,
  attemptId: string,
  studentId: string,
  payload: SubmitActionPayload,
): Promise<SkillTrainerAttemptState> {
  const { data: rawAttempt, error } = await supabase
    .from("student_skill_trainer_attempts")
    .select("*, ucat_skill_trainers(key)")
    .eq("id", attemptId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!rawAttempt) throw new Error("ATTEMPT_NOT_FOUND");

  const trainerKey = (rawAttempt as { ucat_skill_trainers?: { key?: string } }).ucat_skill_trainers?.key;
  if (!trainerKey || !isUcatSkillTrainerKey(trainerKey)) throw new Error("INVALID_TRAINER");
  const resolvedTrainerKey: UcatSkillTrainerKey = trainerKey;

  let attempt = mapAttemptRow(rawAttempt as Record<string, unknown>, resolvedTrainerKey);
  attempt = {
    ...attempt,
    progress: attempt.progress ?? defaultProgress(resolvedTrainerKey),
  };

  attempt = await finalizeAttemptIfExpired(supabase, attempt);
  if (attempt.completed_at || getRemainingSeconds(attempt.ends_at) <= 0) {
    return buildAttemptState(supabase, attempt);
  }

  if (attempt.progress?.cooldown_until && !isInCooldown(attempt.progress)) {
    attempt = {
      ...attempt,
      progress: { ...attempt.progress, cooldown_until: null },
    };
  }

  if (isInCooldown(attempt.progress)) {
    throw new Error("COOLDOWN_ACTIVE");
  }

  const queue = parseQueue(attempt.item_queue_snapshot);
  const currentItemId = queue[attempt.current_item_index];
  if (!currentItemId) throw new Error("NO_CURRENT_ITEM");

  const currentItem = await loadItem(supabase, currentItemId);
  if (!currentItem) throw new Error("ITEM_NOT_FOUND");

  const config = attempt.config_snapshot;
  const allItemIds = await loadApprovedItemIds(supabase, rawAttempt.skill_trainer_id);

  let scoreDelta = 0;
  let newStreak = attempt.streak_count;
  let progress = attempt.progress ?? defaultProgress(resolvedTrainerKey);
  let itemCompleted = false;

  switch (resolvedTrainerKey) {
    case "find_word": {
      const content = currentItem.content as unknown as FindWordItemContent;
      if (payload.type !== "place_word") throw new Error("INVALID_ACTION");
      const keyword = content.keywords.find((k) => k.id === payload.keyword_id);
      if (!keyword) throw new Error("INVALID_KEYWORD");
      if (keyword.target_sentence_index !== payload.sentence_index) {
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(resolvedTrainerKey, applyWrongScore(config));
        progress = setCooldown({ ...progress, type: "find_word", placed_keyword_ids: progress.type === "find_word" ? progress.placed_keyword_ids : [] }, config.wrong_cooldown_seconds);
        break;
      }
      const placed = progress.type === "find_word" ? [...progress.placed_keyword_ids, payload.keyword_id] : [payload.keyword_id];
      newStreak = attempt.streak_count + 1;
      scoreDelta = normalizeScoreDelta(
        resolvedTrainerKey,
        applyCorrectScore(config.points_correct || 10, config, newStreak),
      );
      progress = { type: "find_word", placed_keyword_ids: placed };
      if (placed.length >= content.keywords.length) {
        itemCompleted = true;
        scoreDelta += normalizeScoreDelta(resolvedTrainerKey, 20);
      }
      break;
    }
    case "find_concept": {
      const content = currentItem.content as unknown as FindConceptItemContent;
      const occurrences = content.occurrences ?? [];
      if (payload.type === "click_occurrence") {
        const valid = payload.occurrence_index >= 0 && payload.occurrence_index < occurrences.length;
        const found = progress.type === "find_concept" ? progress.found_occurrence_indexes : [];
        if (!valid || found.includes(payload.occurrence_index)) {
          newStreak = 0;
          scoreDelta = normalizeScoreDelta(resolvedTrainerKey, applyWrongScore(config));
          progress = setCooldown({ type: "find_concept", found_occurrence_indexes: found }, config.wrong_cooldown_seconds);
          break;
        }
        const nextFound = [...found, payload.occurrence_index];
        newStreak = attempt.streak_count + 1;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyCorrectScore(config.points_correct || 10, config, newStreak),
        );
        progress = { type: "find_concept", found_occurrence_indexes: nextFound };
        break;
      }
      if (payload.type === "submit_concept") {
        const found = progress.type === "find_concept" ? progress.found_occurrence_indexes : [];
        if (found.length !== occurrences.length) {
          newStreak = 0;
          scoreDelta = normalizeScoreDelta(resolvedTrainerKey, applyWrongScore(config));
          progress = setCooldown({ type: "find_concept", found_occurrence_indexes: found }, config.wrong_cooldown_seconds);
          break;
        }
        itemCompleted = true;
        newStreak = attempt.streak_count + 1;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyCorrectScore(20, config, newStreak),
        );
        break;
      }
      throw new Error("INVALID_ACTION");
    }
    case "quick_syllogism": {
      const content = currentItem.content as unknown as QuickSyllogismItemContent;
      if (payload.type !== "syllogism_answer") throw new Error("INVALID_ACTION");
      const correct = payload.answer === content.answer;
      if (correct) {
        newStreak = attempt.streak_count + 1;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyCorrectScore(config.points_correct, config, newStreak),
        );
      } else {
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(resolvedTrainerKey, applyWrongScore(config));
        progress = setCooldown({ type: "quick_syllogism" }, config.wrong_cooldown_seconds);
      }
      itemCompleted = correct;
      break;
    }
    case "mental_maths": {
      const content = currentItem.content as unknown as MentalMathsItemContent;
      if (payload.type !== "numeric_answer") throw new Error("INVALID_ACTION");
      const correct = Math.abs(payload.answer - content.answer) < 0.001;
      if (correct) {
        newStreak = attempt.streak_count + 1;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyCorrectScore(scoreMentalMathsItem(content), config, newStreak),
        );
      } else {
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(resolvedTrainerKey, applyWrongScore(config));
      }
      itemCompleted = true;
      break;
    }
    case "numpad_speed": {
      const content = currentItem.content as unknown as NumpadSpeedItemContent;
      if (payload.type !== "numpad_sequence") throw new Error("INVALID_ACTION");
      const expected = content.button_sequence.filter((btn) => btn !== "=");
      const submitted = payload.sequence.filter((btn) => btn !== "=");
      const correct =
        submitted.length === expected.length &&
        submitted.every((btn, i) => btn === expected[i]);
      if (correct) {
        newStreak = attempt.streak_count + 1;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyCorrectScore(scoreNumpadItem(content), config, newStreak),
        );
      } else {
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(resolvedTrainerKey, applyWrongScore(config));
        progress = setCooldown({ type: "numpad_speed" }, config.wrong_cooldown_seconds);
      }
      itemCompleted = correct;
      break;
    }
    case "calculator_maths": {
      const content = currentItem.content as unknown as CalculatorMathsItemContent;
      if (payload.type !== "numeric_answer") throw new Error("INVALID_ACTION");
      const correct = Math.abs(payload.answer - content.answer) < 0.001;
      if (correct) {
        newStreak = attempt.streak_count + 1;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyCorrectScore(config.points_correct, config, newStreak),
        );
      } else {
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(resolvedTrainerKey, applyWrongScore(config));
        progress = setCooldown({ type: "calculator_maths" }, config.wrong_cooldown_seconds);
      }
      itemCompleted = true;
      break;
    }
  }

  if (itemCompleted) {
    const updated = await completeCurrentItem(
      supabase,
      { ...attempt, streak_count: newStreak },
      currentItemId,
      scoreDelta,
      { action: payload.type, correct: scoreDelta >= 0 },
      allItemIds,
    );
    return buildAttemptState(supabase, { ...updated, streak_count: newStreak });
  }

  const partialScore = Number(attempt.score) + scoreDelta;
  const { data: updated, error: updateError } = await supabase
    .from("student_skill_trainer_attempts")
    .update({
      score: partialScore,
      streak_count: newStreak,
      progress,
    })
    .eq("id", attempt.id)
    .select("*")
    .maybeSingle();

  if (updateError) throw new Error(updateError.message);

  return buildAttemptState(supabase, {
    ...mapAttemptRow(updated as Record<string, unknown>, resolvedTrainerKey),
    progress,
    streak_count: newStreak,
    score: partialScore,
  });
}

export async function getLeaderboard(
  supabase: AdminClient,
  trainerKey: string,
  window: "week" | "all_time" | "my_scores",
  studentTimezone: string,
  studentId?: string,
  limit = 50,
): Promise<
  Array<{
    student_id: string;
    display_name: string;
    best_score: number;
    achieved_at: string;
    rank: number;
  }>
> {
  const trainer = await loadTrainerByKey(supabase, trainerKey);
  if (!trainer) return [];

  if (window === "my_scores") {
    if (!studentId) return [];
    const { data, error } = await supabase
      .from("student_skill_trainer_attempts")
      .select("student_id, score, completed_at")
      .eq("skill_trainer_id", trainer.id)
      .eq("student_id", studentId)
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);

    return (data ?? []).map((row, index) => ({
      student_id: row.student_id,
      display_name: "You",
      best_score: Number(row.score),
      achieved_at: row.completed_at as string,
      rank: index + 1,
    }));
  }

  let periodStart: string | null = null;
  if (window === "week") {
    const { getQuotaPeriodStart } = await import("@/lib/ucat/quota/period");
    periodStart = getQuotaPeriodStart("week", studentTimezone).toISOString();
  }

  let query = supabase
    .from("student_skill_trainer_attempts")
    .select("student_id, score, completed_at, students(first_name, last_name)")
    .eq("skill_trainer_id", trainer.id)
    .not("completed_at", "is", null)
    .order("score", { ascending: false })
    .order("completed_at", { ascending: true });

  if (periodStart) {
    query = query.gte("completed_at", periodStart);
  }

  const { data, error } = await query.limit(500);
  if (error) throw new Error(error.message);

  const bestByStudent = new Map<
    string,
    { best_score: number; achieved_at: string; display_name: string }
  >();

  for (const row of data ?? []) {
    const rowStudentId = row.student_id;
    const score = Number(row.score);
    const completedAt = row.completed_at as string;
    const student = row.students as { first_name?: string | null; last_name?: string | null } | null;
    const displayName = [student?.first_name, student?.last_name].filter(Boolean).join(" ") || "Student";
    const existing = bestByStudent.get(rowStudentId);
    if (!existing || score > existing.best_score) {
      bestByStudent.set(rowStudentId, { best_score: score, achieved_at: completedAt, display_name: displayName });
    } else if (existing && score === existing.best_score && completedAt < existing.achieved_at) {
      bestByStudent.set(rowStudentId, { ...existing, achieved_at: completedAt });
    }
  }

  return [...bestByStudent.entries()]
    .map(([id, value]) => ({ student_id: id, ...value }))
    .sort((a, b) => {
      if (b.best_score !== a.best_score) return b.best_score - a.best_score;
      return a.achieved_at.localeCompare(b.achieved_at);
    })
    .slice(0, limit)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
