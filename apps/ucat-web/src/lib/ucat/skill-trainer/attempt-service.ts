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
import {
  extractSkillTrainerPlainText,
  findFindWordKeywordOccurrences,
} from "@altitutor/shared";
import type {
  SkillTrainerAttemptState,
  SubmitActionPayload,
} from "@/features/skill-trainer/types/attempt";
import type { QuotaExceededPayload } from "@/features/ucat-access/types/quota";
import { advanceQueue } from "@/lib/ucat/skill-trainer/queue";

export type { SkillTrainerAttemptState, SubmitActionPayload };
import {
  applyCorrectScore,
  applyWrongScore,
  calculateSpeedBonus,
  normalizeScoreDelta,
  scoreMentalMathsItem,
  scoreNumpadItem,
} from "@/lib/ucat/skill-trainer/scoring";

type AdminClient = SupabaseClient<Database>;

export const SKILL_TRAINER_ACTION_DEADLINE_GRACE_MS = 3_000;

export function isSkillTrainerActionWithinDeadline(
  endsAt: string,
  actionReceivedAt: Date,
): boolean {
  const deadlineMs = Date.parse(endsAt);
  return (
    Number.isFinite(deadlineMs) &&
    actionReceivedAt.getTime() <=
      deadlineMs + SKILL_TRAINER_ACTION_DEADLINE_GRACE_MS
  );
}

type AttemptTrainerRelation = {
  key?: string | null;
  is_enabled?: boolean | null;
} | null;

type AttemptRow = {
  id: string;
  student_id: string;
  skill_trainer_id: string;
  score: number;
  streak_count: number;
  item_queue_snapshot: string[];
  current_item_index: number;
  current_item_started_at: string | null;
  progress: SkillTrainerAttemptProgress | null;
  config_snapshot: SkillTrainerConfigSnapshot;
  ends_at: string;
  started_at: string;
  completed_at: string | null;
  discarded_at: string | null;
  trainer_key: UcatSkillTrainerKey;
  version: number;
};

type ItemRow = {
  id: string;
  content: Record<string, unknown>;
};

function parseQueue(snapshot: unknown): string[] {
  if (!Array.isArray(snapshot)) return [];
  return snapshot.filter((id): id is string => typeof id === "string");
}

function parseConfig(
  snapshot: unknown,
  trainerKey: UcatSkillTrainerKey,
): SkillTrainerConfigSnapshot {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("INVALID_CONFIG_SNAPSHOT");
  }
  const raw = snapshot as Partial<SkillTrainerConfigSnapshot>;
  if (
    typeof raw.time_limit_seconds !== "number" ||
    typeof raw.points_correct !== "number" ||
    typeof raw.points_wrong !== "number" ||
    typeof raw.streak_enabled !== "boolean" ||
    !Array.isArray(raw.streak_multiplier_steps) ||
    typeof raw.speed_bonus_enabled !== "boolean" ||
    typeof raw.speed_bonus_max_points !== "number" ||
    typeof raw.speed_bonus_window_seconds !== "number" ||
    raw.trainer_key !== trainerKey
  ) {
    throw new Error("INVALID_CONFIG_SNAPSHOT");
  }
  return {
    time_limit_seconds: raw.time_limit_seconds,
    points_correct: raw.points_correct,
    points_wrong: raw.points_wrong,
    streak_enabled: raw.streak_enabled,
    streak_multiplier_steps: raw.streak_multiplier_steps,
    speed_bonus_enabled: raw.speed_bonus_enabled,
    speed_bonus_max_points: raw.speed_bonus_max_points,
    speed_bonus_window_seconds: raw.speed_bonus_window_seconds,
    trainer_key: trainerKey,
  };
}

function defaultProgress(
  trainerKey: UcatSkillTrainerKey,
): SkillTrainerAttemptProgress {
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
  if (attempt.completed_at || attempt.discarded_at) return attempt;
  if (getRemainingSeconds(attempt.ends_at) > 0) return attempt;

  const { data, error } = await supabase
    .from("student_skill_trainer_attempts")
    .update({
      completed_at: new Date().toISOString(),
      progress: null,
    })
    .eq("id", attempt.id)
    .is("completed_at", null)
    .is("discarded_at", null)
    .select("*")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return mapAttemptRow(data, attempt.trainer_key);
  return getAttemptForStudent(supabase, attempt.id, attempt.student_id);
}

export async function discardSkillTrainerAttempt(
  supabase: AdminClient,
  attemptId: string,
  studentId: string,
): Promise<boolean> {
  const rpcClient = supabase as unknown as {
    rpc: (
      functionName: "discard_ucat_skill_trainer_attempt",
      params: { p_student_id: string; p_attempt_id: string },
    ) => Promise<{
      data: boolean | null;
      error: { message: string } | null;
    }>;
  };
  const { data, error } = await rpcClient.rpc(
    "discard_ucat_skill_trainer_attempt",
    {
      p_student_id: studentId,
      p_attempt_id: attemptId,
    },
  );
  if (error) throw new Error(error.message);
  return data === true;
}

function mapAttemptRow(
  row: Record<string, unknown>,
  trainerKey: string,
): AttemptRow {
  if (!isUcatSkillTrainerKey(trainerKey)) throw new Error("INVALID_TRAINER");
  return {
    id: row.id as string,
    student_id: row.student_id as string,
    skill_trainer_id: row.skill_trainer_id as string,
    score: Number(row.score),
    streak_count: Number(row.streak_count),
    item_queue_snapshot: parseQueue(row.item_queue_snapshot),
    current_item_index: Number(row.current_item_index),
    current_item_started_at:
      (row.current_item_started_at as string | null) ?? null,
    progress: (row.progress as SkillTrainerAttemptProgress | null) ?? null,
    config_snapshot: parseConfig(row.config_snapshot, trainerKey),
    ends_at: row.ends_at as string,
    started_at: row.started_at as string,
    completed_at: (row.completed_at as string | null) ?? null,
    discarded_at: (row.discarded_at as string | null) ?? null,
    trainer_key: trainerKey,
    version: Number(row.version ?? 0),
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
  limit?: number,
): Promise<string[]> {
  if (limit != null) {
    const rpcClient = supabase as unknown as {
      rpc: (
        functionName: "get_skill_trainer_item_queue",
        params: { p_skill_trainer_id: string; p_limit: number },
      ) => Promise<{
        data: string[] | null;
        error: { message: string } | null;
      }>;
    };
    const { data, error } = await rpcClient.rpc(
      "get_skill_trainer_item_queue",
      { p_skill_trainer_id: skillTrainerId, p_limit: limit },
    );
    if (error) throw new Error(error.message);
    return data ?? [];
  }
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

async function loadItemsById(
  supabase: AdminClient,
  itemIds: string[],
): Promise<Map<string, ItemRow>> {
  if (itemIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("ucat_skill_trainer_items")
    .select("id, content")
    .in("id", itemIds);
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((row) => [
      row.id,
      { id: row.id, content: row.content as Record<string, unknown> },
    ]),
  );
}

export async function getUnfinishedSkillTrainerAttempt(
  supabase: AdminClient,
  studentId: string,
): Promise<AttemptRow | null> {
  const { data, error } = await supabase
    .from("student_skill_trainer_attempts")
    .select("*, ucat_skill_trainers(key, is_enabled)")
    .eq("student_id", studentId)
    .is("completed_at", null)
    .is("discarded_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const trainer = (data as { ucat_skill_trainers?: AttemptTrainerRelation })
    .ucat_skill_trainers;
  if (trainer?.is_enabled !== true) {
    const { error: closeError } = await supabase
      .from("student_skill_trainer_attempts")
      .update({ completed_at: new Date().toISOString(), progress: null })
      .eq("id", data.id)
      .eq("student_id", studentId)
      .is("completed_at", null)
      .is("discarded_at", null);
    if (closeError) throw new Error(closeError.message);
    return null;
  }

  const trainerKey = trainer.key;
  if (!trainerKey || !isUcatSkillTrainerKey(trainerKey)) {
    throw new Error("INVALID_TRAINER");
  }
  const attempt = mapAttemptRow(data as Record<string, unknown>, trainerKey);

  return attempt;
}

async function getAttemptForStudent(
  supabase: AdminClient,
  attemptId: string,
  studentId: string,
): Promise<AttemptRow> {
  const { data, error } = await supabase
    .from("student_skill_trainer_attempts")
    .select("*, ucat_skill_trainers(key, is_enabled)")
    .eq("id", attemptId)
    .eq("student_id", studentId)
    .is("discarded_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("ATTEMPT_NOT_FOUND");
  const trainer = (data as { ucat_skill_trainers?: AttemptTrainerRelation })
    .ucat_skill_trainers;
  if (trainer?.is_enabled !== true) throw new Error("TRAINER_NOT_FOUND");
  if (!trainer.key || !isUcatSkillTrainerKey(trainer.key)) {
    throw new Error("INVALID_TRAINER");
  }
  return mapAttemptRow(data as unknown as Record<string, unknown>, trainer.key);
}

export async function buildAttemptState(
  supabase: AdminClient,
  attempt: AttemptRow,
): Promise<SkillTrainerAttemptState> {
  const finalized = await finalizeAttemptIfExpired(supabase, attempt);
  const queue = parseQueue(finalized.item_queue_snapshot);
  const currentItemId = queue[finalized.current_item_index] ?? null;
  const nextItemId = queue[finalized.current_item_index + 1] ?? null;
  const items = await loadItemsById(
    supabase,
    [currentItemId, nextItemId].filter((id): id is string => Boolean(id)),
  );
  const currentItem = currentItemId ? (items.get(currentItemId) ?? null) : null;
  const nextItem = nextItemId ? (items.get(nextItemId) ?? null) : null;
  const remainingSeconds = getRemainingSeconds(finalized.ends_at);
  const isExpired = remainingSeconds <= 0;
  const isCompleted =
    finalized.completed_at != null ||
    finalized.discarded_at != null ||
    isExpired;

  return {
    attempt: {
      ...finalized,
      item_queue_snapshot: queue,
    },
    currentItem,
    nextItem,
    remainingSeconds,
    isExpired,
    isCompleted,
  };
}

export type StartSkillTrainerAttemptResult =
  | { started: true; state: SkillTrainerAttemptState }
  | { started: false; quota: QuotaExceededPayload };

type StartSkillTrainerAttemptRpcResult = {
  status?: string;
  state?: SkillTrainerAttemptState;
  quota?: QuotaExceededPayload;
};

export async function startSkillTrainerAttempt(
  supabase: AdminClient,
  userId: string,
  trainerKey: string,
): Promise<StartSkillTrainerAttemptResult> {
  if (!isUcatSkillTrainerKey(trainerKey)) throw new Error("TRAINER_NOT_FOUND");
  const rpcClient = supabase as unknown as {
    rpc: (
      functionName: "start_ucat_skill_trainer_attempt",
      params: { p_user_id: string; p_trainer_key: UcatSkillTrainerKey },
    ) => Promise<{
      data: StartSkillTrainerAttemptRpcResult | null;
      error: { message: string } | null;
    }>;
  };
  const { data, error } = await rpcClient.rpc(
    "start_ucat_skill_trainer_attempt",
    { p_user_id: userId, p_trainer_key: trainerKey },
  );
  if (error) throw new Error(error.message);
  if (!data?.status) throw new Error("FAILED_TO_START");

  if (data.status === "started") {
    if (!data.state?.attempt || !data.state.currentItem) {
      throw new Error("INVALID_START_RESPONSE");
    }
    return { started: true, state: data.state };
  }
  if (data.status === "quota_exceeded") {
    if (!data.quota) throw new Error("INVALID_QUOTA_RESPONSE");
    return { started: false, quota: data.quota };
  }

  const errors: Record<string, string> = {
    student_not_found: "STUDENT_NOT_FOUND",
    trainer_not_found: "TRAINER_NOT_FOUND",
    trainer_config_not_found: "TRAINER_CONFIG_NOT_FOUND",
    quota_config_not_found: "QUOTA_CONFIG_NOT_FOUND",
    invalid_quota_period: "INVALID_QUOTA_PERIOD",
    no_items_available: "NO_ITEMS_AVAILABLE",
  };
  throw new Error(errors[data.status] ?? "FAILED_TO_START");
}

async function completeCurrentItem(
  supabase: AdminClient,
  attempt: AttemptRow,
  itemId: string,
  actionId: string,
  expectedVersion: number,
  actionReceivedAt: Date,
  scoreDelta: number,
  result: Record<string, unknown>,
  loadAllItemIds: () => Promise<string[]>,
): Promise<AttemptRow | null> {
  const newScore = Number(attempt.score) + scoreDelta;
  const currentQueue = parseQueue(attempt.item_queue_snapshot);
  let queue = currentQueue;
  let currentIndex = attempt.current_item_index + 1;
  if (currentIndex >= currentQueue.length) {
    const allItemIds = await loadAllItemIds();
    const advanced = advanceQueue(
      currentQueue,
      attempt.current_item_index,
      allItemIds,
      itemId,
    );
    queue = advanced.queue;
    currentIndex = advanced.currentIndex;
  }

  const trainerKey = attempt.config_snapshot.trainer_key;
  const nextProgress = defaultProgress(trainerKey);
  const nextItemStartedAt = new Date().toISOString();
  const version = await commitSkillTrainerAction(supabase, {
    attempt,
    actionId,
    expectedVersion,
    actionReceivedAt,
    expectedItemId: itemId,
    score: newScore,
    streakCount: attempt.streak_count,
    progress: nextProgress,
    queue,
    currentItemIndex: currentIndex,
    currentItemStartedAt: nextItemStartedAt,
    itemCompleted: true,
    scoreDelta,
    result,
  });
  if (version == null) return null;
  return {
    ...attempt,
    score: newScore,
    item_queue_snapshot: queue,
    current_item_index: currentIndex,
    current_item_started_at: nextItemStartedAt,
    progress: nextProgress,
    version,
  };
}

type CommitSkillTrainerActionInput = {
  attempt: AttemptRow;
  actionId: string;
  expectedVersion: number;
  actionReceivedAt: Date;
  expectedItemId: string;
  score: number;
  streakCount: number;
  progress: SkillTrainerAttemptProgress;
  queue: string[];
  currentItemIndex: number;
  currentItemStartedAt: string | null;
  itemCompleted: boolean;
  scoreDelta: number;
  result: Record<string, unknown>;
};

async function commitSkillTrainerAction(
  supabase: AdminClient,
  input: CommitSkillTrainerActionInput,
): Promise<number | null> {
  const rpcClient = supabase as unknown as {
    rpc: (
      functionName: "commit_student_skill_trainer_action",
      params: Record<string, unknown>,
    ) => Promise<{
      data: { status?: string; version?: number } | null;
      error: { message: string } | null;
    }>;
  };
  const { data, error } = await rpcClient.rpc(
    "commit_student_skill_trainer_action",
    {
      p_attempt_id: input.attempt.id,
      p_student_id: input.attempt.student_id,
      p_action_id: input.actionId,
      p_expected_version: input.expectedVersion,
      p_expected_item_id: input.expectedItemId,
      p_score: input.score,
      p_streak_count: input.streakCount,
      p_progress: input.progress as unknown as Json,
      p_item_queue_snapshot: input.queue as unknown as Json,
      p_current_item_index: input.currentItemIndex,
      p_current_item_started_at: input.currentItemStartedAt,
      p_item_completed: input.itemCompleted,
      p_score_delta: input.scoreDelta,
      p_result: {
        ...input.result,
        action_received_at: input.actionReceivedAt.toISOString(),
      } as Json,
    },
  );
  if (error) throw new Error(error.message);
  if (data?.status === "duplicate") return null;
  if (data?.status === "stale") throw new Error("STALE_ATTEMPT");
  if (data?.status === "not_found") throw new Error("ATTEMPT_NOT_FOUND");
  if (data?.status === "completed") throw new Error("ATTEMPT_COMPLETED");
  if (data?.status !== "applied" || !Number.isSafeInteger(data.version)) {
    throw new Error("FAILED_TO_COMMIT_ACTION");
  }
  return data.version as number;
}

export async function submitSkillTrainerAction(
  supabase: AdminClient,
  attemptId: string,
  studentId: string,
  payload: SubmitActionPayload,
  actionId: string,
  expectedVersion: number,
  actionReceivedAt = new Date(),
): Promise<SkillTrainerAttemptState> {
  const { data: rawAttempt, error } = await supabase
    .from("student_skill_trainer_attempts")
    .select("*, ucat_skill_trainers(key, is_enabled)")
    .eq("id", attemptId)
    .eq("student_id", studentId)
    .is("discarded_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!rawAttempt) throw new Error("ATTEMPT_NOT_FOUND");

  const trainer = (
    rawAttempt as { ucat_skill_trainers?: AttemptTrainerRelation }
  ).ucat_skill_trainers;
  if (trainer?.is_enabled !== true) throw new Error("TRAINER_NOT_FOUND");
  const trainerKey = trainer.key ?? undefined;
  if (!trainerKey || !isUcatSkillTrainerKey(trainerKey))
    throw new Error("INVALID_TRAINER");
  const resolvedTrainerKey: UcatSkillTrainerKey = trainerKey;

  let attempt = mapAttemptRow(
    rawAttempt as Record<string, unknown>,
    resolvedTrainerKey,
  );
  attempt = {
    ...attempt,
    progress: attempt.progress ?? defaultProgress(resolvedTrainerKey),
  };

  const actionWithinDeadline = isSkillTrainerActionWithinDeadline(
    attempt.ends_at,
    actionReceivedAt,
  );
  if (!actionWithinDeadline) {
    attempt = await finalizeAttemptIfExpired(supabase, attempt);
  }
  if (attempt.completed_at || !actionWithinDeadline) {
    return buildAttemptState(supabase, attempt);
  }

  const queue = parseQueue(attempt.item_queue_snapshot);
  const currentItemId = queue[attempt.current_item_index];
  if (!currentItemId) throw new Error("NO_CURRENT_ITEM");

  const currentItem = await loadItem(supabase, currentItemId);
  if (!currentItem) throw new Error("ITEM_NOT_FOUND");

  const config = attempt.config_snapshot;
  const loadAllItemIds = () =>
    loadApprovedItemIds(supabase, rawAttempt.skill_trainer_id);

  let scoreDelta = 0;
  let newStreak = attempt.streak_count;
  let progress = attempt.progress ?? defaultProgress(resolvedTrainerKey);
  let itemCompleted = false;
  let actionCorrect: boolean | null = null;

  switch (resolvedTrainerKey) {
    case "find_word": {
      const content = currentItem.content as unknown as FindWordItemContent;
      if (payload.type !== "place_word") throw new Error("INVALID_ACTION");
      const keyword = content.keywords.find((k) => k.id === payload.keyword_id);
      if (!keyword) throw new Error("INVALID_KEYWORD");
      const plain = extractSkillTrainerPlainText(content.passage, {
        blockSeparator: "\n",
      });
      const validTarget = findFindWordKeywordOccurrences(plain, keyword).some(
        (occurrence) =>
          payload.character_index >= occurrence.start &&
          payload.character_index < occurrence.end,
      );
      if (!validTarget) {
        actionCorrect = false;
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyWrongScore(config),
        );
        progress = {
          type: "find_word",
          placed_keyword_ids:
            progress.type === "find_word" ? progress.placed_keyword_ids : [],
        };
        break;
      }
      actionCorrect = true;
      const placed =
        progress.type === "find_word"
          ? [...new Set([...progress.placed_keyword_ids, payload.keyword_id])]
          : [payload.keyword_id];
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
      const found =
        progress.type === "find_concept"
          ? progress.found_occurrence_indexes
          : [];
      if (payload.type === "skip_concept") {
        actionCorrect = false;
        const missingCount = Math.max(0, occurrences.length - found.length);
        newStreak = 0;
        scoreDelta =
          normalizeScoreDelta(resolvedTrainerKey, applyWrongScore(config)) *
          missingCount;
        progress = { type: "find_concept", found_occurrence_indexes: found };
        itemCompleted = true;
        break;
      }
      if (payload.type === "click_occurrence") {
        const valid =
          payload.occurrence_index >= 0 &&
          payload.occurrence_index < occurrences.length;
        if (!valid || found.includes(payload.occurrence_index)) {
          actionCorrect = false;
          newStreak = 0;
          scoreDelta = normalizeScoreDelta(
            resolvedTrainerKey,
            applyWrongScore(config),
          );
          progress = { type: "find_concept", found_occurrence_indexes: found };
          break;
        }
        actionCorrect = true;
        const nextFound = [...found, payload.occurrence_index];
        newStreak = attempt.streak_count + 1;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyCorrectScore(config.points_correct || 10, config, newStreak),
        );
        progress = {
          type: "find_concept",
          found_occurrence_indexes: nextFound,
        };
        if (nextFound.length >= occurrences.length) {
          itemCompleted = true;
          scoreDelta += normalizeScoreDelta(resolvedTrainerKey, 20);
        }
        break;
      }
      throw new Error("INVALID_ACTION");
    }
    case "quick_syllogism": {
      const content =
        currentItem.content as unknown as QuickSyllogismItemContent;
      if (payload.type !== "syllogism_answer")
        throw new Error("INVALID_ACTION");
      const correct = payload.answer === content.answer;
      actionCorrect = correct;
      if (correct) {
        newStreak = attempt.streak_count + 1;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyCorrectScore(config.points_correct, config, newStreak),
        );
      } else {
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyWrongScore(config),
        );
        progress = { type: "quick_syllogism" };
      }
      itemCompleted = true;
      break;
    }
    case "mental_maths": {
      const content = currentItem.content as unknown as MentalMathsItemContent;
      if (payload.type !== "numeric_answer") throw new Error("INVALID_ACTION");
      const correct = Math.abs(payload.answer - content.answer) < 0.001;
      actionCorrect = correct;
      if (correct) {
        newStreak = attempt.streak_count + 1;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyCorrectScore(scoreMentalMathsItem(content), config, newStreak),
        );
      } else {
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyWrongScore(config),
        );
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
      actionCorrect = correct;
      if (correct) {
        newStreak = attempt.streak_count + 1;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyCorrectScore(scoreNumpadItem(content), config, newStreak),
        );
      } else {
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyWrongScore(config),
        );
        progress = { type: "numpad_speed" };
      }
      itemCompleted = true;
      break;
    }
    case "calculator_maths": {
      const content =
        currentItem.content as unknown as CalculatorMathsItemContent;
      if (payload.type !== "numeric_answer") throw new Error("INVALID_ACTION");
      const correct = Math.abs(payload.answer - content.answer) < 0.001;
      actionCorrect = correct;
      if (correct) {
        newStreak = attempt.streak_count + 1;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyCorrectScore(config.points_correct, config, newStreak),
        );
      } else {
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(
          resolvedTrainerKey,
          applyWrongScore(config),
        );
        progress = { type: "calculator_maths" };
      }
      itemCompleted = true;
      break;
    }
  }

  if (itemCompleted) {
    const speedBonus =
      scoreDelta > 0
        ? normalizeScoreDelta(
            resolvedTrainerKey,
            calculateSpeedBonus(config, attempt.current_item_started_at),
          )
        : 0;
    const finalScoreDelta = scoreDelta + speedBonus;
    const updated = await completeCurrentItem(
      supabase,
      { ...attempt, streak_count: newStreak },
      currentItemId,
      actionId,
      expectedVersion,
      actionReceivedAt,
      finalScoreDelta,
      {
        action: payload.type,
        correct: actionCorrect ?? scoreDelta > 0,
        answer:
          payload.type === "syllogism_answer" ||
          payload.type === "numeric_answer"
            ? payload.answer
            : payload.type === "numpad_sequence"
              ? payload.sequence
              : payload.type,
        elapsed_seconds: attempt.current_item_started_at
          ? Math.max(
              0,
              Math.round(
                (Date.now() - Date.parse(attempt.current_item_started_at)) /
                  1000,
              ),
            )
          : null,
        speed_bonus: speedBonus,
      },
      loadAllItemIds,
    );
    if (!updated) {
      const canonical = await getAttemptForStudent(
        supabase,
        attemptId,
        studentId,
      );
      return buildAttemptState(supabase, canonical);
    }
    return buildAttemptState(supabase, { ...updated, streak_count: newStreak });
  }

  const partialScore = Number(attempt.score) + scoreDelta;
  const version = await commitSkillTrainerAction(supabase, {
    attempt,
    actionId,
    expectedVersion,
    actionReceivedAt,
    expectedItemId: currentItemId,
    score: partialScore,
    streakCount: newStreak,
    progress,
    queue,
    currentItemIndex: attempt.current_item_index,
    currentItemStartedAt: attempt.current_item_started_at,
    itemCompleted: false,
    scoreDelta,
    result: {
      action: payload.type,
      correct: actionCorrect ?? scoreDelta > 0,
    },
  });
  if (version == null) {
    const canonical = await getAttemptForStudent(
      supabase,
      attemptId,
      studentId,
    );
    return buildAttemptState(supabase, canonical);
  }

  return buildAttemptState(supabase, {
    ...attempt,
    progress,
    streak_count: newStreak,
    score: partialScore,
    version,
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
  if (!trainer) throw new Error("TRAINER_NOT_FOUND");

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
    const student = row.students as {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
    const displayName =
      [student?.first_name, student?.last_name].filter(Boolean).join(" ") ||
      "Student";
    const existing = bestByStudent.get(rowStudentId);
    if (!existing || score > existing.best_score) {
      bestByStudent.set(rowStudentId, {
        best_score: score,
        achieved_at: completedAt,
        display_name: displayName,
      });
    } else if (
      existing &&
      score === existing.best_score &&
      completedAt < existing.achieved_at
    ) {
      bestByStudent.set(rowStudentId, {
        ...existing,
        achieved_at: completedAt,
      });
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
