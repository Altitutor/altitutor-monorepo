import type {
  CalculatorMathsItemContent,
  FindConceptItemContent,
  FindWordItemContent,
  MentalMathsItemContent,
  NumpadSpeedItemContent,
  QuickSyllogismItemContent,
  SkillTrainerAttemptProgress,
  UcatSkillTrainerKey,
} from "@altitutor/shared";
import {
  extractSkillTrainerPlainText,
  findFindWordKeywordOccurrences,
} from "@altitutor/shared";
import type {
  SkillTrainerAttemptState,
  SubmitActionPayload,
} from "@/features/skill-trainer/types/attempt";
import {
  applyCorrectScore,
  applyWrongScore,
  normalizeScoreDelta,
  scoreMentalMathsItem,
  scoreNumpadItem,
} from "@/lib/ucat/skill-trainer/scoring";

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

function updateLocalProgress(
  state: SkillTrainerAttemptState,
  scoreDelta: number,
  streakCount: number,
  progress: SkillTrainerAttemptProgress,
): SkillTrainerAttemptState {
  return {
    ...state,
    attempt: {
      ...state.attempt,
      score: state.attempt.score + scoreDelta,
      streak_count: streakCount,
      progress,
    },
  };
}

export function expireLocalSkillTrainerSession(
  state: SkillTrainerAttemptState,
): SkillTrainerAttemptState {
  return {
    ...state,
    remainingSeconds: 0,
    isExpired: true,
    isCompleted: true,
    attempt: {
      ...state.attempt,
      completed_at: state.attempt.completed_at ?? new Date().toISOString(),
      progress: null,
    },
  };
}

export function submitLocalSkillTrainerAction(
  state: SkillTrainerAttemptState,
  trainerKey: UcatSkillTrainerKey,
  payload: SubmitActionPayload,
  itemsById: Map<string, { id: string; content: Record<string, unknown> }>,
  options: { completeOnQueueEnd?: boolean } = {},
): SkillTrainerAttemptState {
  const currentItem = state.currentItem;
  if (!currentItem || state.isCompleted) return state;

  const config = state.attempt.config_snapshot;
  const progress = state.attempt.progress ?? defaultProgress(trainerKey);
  let scoreDelta = 0;
  let newStreak = state.attempt.streak_count;
  let nextProgress = progress;
  let itemCompleted = false;

  switch (trainerKey) {
    case "find_word": {
      if (payload.type !== "place_word") return state;
      const content = currentItem.content as unknown as FindWordItemContent;
      const keyword = content.keywords.find((k) => k.id === payload.keyword_id);
      const placedIds =
        progress.type === "find_word" ? progress.placed_keyword_ids : [];

      const plain = extractSkillTrainerPlainText(content.passage, { blockSeparator: "\n" });
      const validTarget = keyword
        ? findFindWordKeywordOccurrences(plain, keyword).some(
            (occurrence) =>
              payload.character_index >= occurrence.start &&
              payload.character_index < occurrence.end,
          )
        : false;

      if (!keyword || !validTarget) {
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(trainerKey, applyWrongScore(config));
        nextProgress = { type: "find_word", placed_keyword_ids: placedIds };
        break;
      }

      const nextPlacedIds = [...new Set([...placedIds, payload.keyword_id])];
      newStreak += 1;
      scoreDelta = normalizeScoreDelta(
        trainerKey,
        applyCorrectScore(config.points_correct || 10, config, newStreak),
      );
      nextProgress = { type: "find_word", placed_keyword_ids: nextPlacedIds };
      if (nextPlacedIds.length >= content.keywords.length) {
        itemCompleted = true;
        scoreDelta += normalizeScoreDelta(trainerKey, 20);
      }
      break;
    }
    case "find_concept": {
      const content = currentItem.content as unknown as FindConceptItemContent;
      const occurrences = content.occurrences ?? [];
      const found =
        progress.type === "find_concept" ? progress.found_occurrence_indexes : [];

      if (payload.type === "skip_concept") {
        const missingCount = Math.max(0, occurrences.length - found.length);
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(trainerKey, applyWrongScore(config)) * missingCount;
        nextProgress = { type: "find_concept", found_occurrence_indexes: found };
        itemCompleted = true;
        break;
      }

      if (payload.type === "click_occurrence") {
        const valid =
          payload.occurrence_index >= 0 &&
          payload.occurrence_index < occurrences.length &&
          !found.includes(payload.occurrence_index);
        if (!valid) {
          newStreak = 0;
          scoreDelta = normalizeScoreDelta(trainerKey, applyWrongScore(config));
          nextProgress = { type: "find_concept", found_occurrence_indexes: found };
          break;
        }
        newStreak += 1;
        scoreDelta = normalizeScoreDelta(
          trainerKey,
          applyCorrectScore(config.points_correct || 10, config, newStreak),
        );
        nextProgress = {
          type: "find_concept",
          found_occurrence_indexes: [...found, payload.occurrence_index],
        };
        if (nextProgress.found_occurrence_indexes.length >= occurrences.length) {
          itemCompleted = true;
          scoreDelta += normalizeScoreDelta(trainerKey, 20);
        }
        break;
      }

      break;
    }
    case "quick_syllogism": {
      if (payload.type !== "syllogism_answer") return state;
      const content = currentItem.content as unknown as QuickSyllogismItemContent;
      const correct = payload.answer === content.answer;
      if (correct) {
        newStreak += 1;
        scoreDelta = normalizeScoreDelta(
          trainerKey,
          applyCorrectScore(config.points_correct, config, newStreak),
        );
      } else {
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(trainerKey, applyWrongScore(config));
        nextProgress = { type: "quick_syllogism" };
      }
      itemCompleted = true;
      break;
    }
    case "mental_maths": {
      if (payload.type !== "numeric_answer") return state;
      const content = currentItem.content as unknown as MentalMathsItemContent;
      const correct = Math.abs(payload.answer - content.answer) < 0.001;
      if (correct) {
        newStreak += 1;
        scoreDelta = normalizeScoreDelta(
          trainerKey,
          applyCorrectScore(scoreMentalMathsItem(content), config, newStreak),
        );
      } else {
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(trainerKey, applyWrongScore(config));
      }
      itemCompleted = true;
      break;
    }
    case "numpad_speed": {
      if (payload.type !== "numpad_sequence") return state;
      const content = currentItem.content as unknown as NumpadSpeedItemContent;
      const expected = content.button_sequence.filter((btn) => btn !== "=");
      const submitted = payload.sequence.filter((btn) => btn !== "=");
      const correct =
        submitted.length === expected.length &&
        submitted.every((btn, index) => btn === expected[index]);
      if (correct) {
        newStreak += 1;
        scoreDelta = normalizeScoreDelta(
          trainerKey,
          applyCorrectScore(scoreNumpadItem(content), config, newStreak),
        );
      } else {
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(trainerKey, applyWrongScore(config));
        nextProgress = { type: "numpad_speed" };
      }
      itemCompleted = true;
      break;
    }
    case "calculator_maths": {
      if (payload.type !== "numeric_answer") return state;
      const content = currentItem.content as unknown as CalculatorMathsItemContent;
      const correct = Math.abs(payload.answer - content.answer) < 0.001;
      if (correct) {
        newStreak += 1;
        scoreDelta = normalizeScoreDelta(
          trainerKey,
          applyCorrectScore(config.points_correct, config, newStreak),
        );
      } else {
        newStreak = 0;
        scoreDelta = normalizeScoreDelta(trainerKey, applyWrongScore(config));
        nextProgress = { type: "calculator_maths" };
      }
      itemCompleted = true;
      break;
    }
  }

  if (itemCompleted) {
    return completeLocalItemWithItems(
      state,
      scoreDelta,
      newStreak,
      itemsById,
      options,
    );
  }

  return updateLocalProgress(state, scoreDelta, newStreak, nextProgress);
}

function completeLocalItemWithItems(
  state: SkillTrainerAttemptState,
  scoreDelta: number,
  streakCount: number,
  itemsById: Map<string, { id: string; content: Record<string, unknown> }>,
  options: { completeOnQueueEnd?: boolean } = {},
): SkillTrainerAttemptState {
  const queue = state.attempt.item_queue_snapshot;
  const nextIndex = state.attempt.current_item_index + 1;
  const shouldCompleteOnQueueEnd = options.completeOnQueueEnd ?? true;
  const nextQueueIndex =
    queue.length > 0 && !shouldCompleteOnQueueEnd
      ? nextIndex % queue.length
      : nextIndex;
  const afterNextQueueIndex =
    queue.length > 0 && !shouldCompleteOnQueueEnd
      ? (nextIndex + 1) % queue.length
      : nextIndex + 1;
  const nextItemId = queue[nextQueueIndex] ?? null;
  const afterNextItemId = queue[afterNextQueueIndex] ?? null;
  const nextItem = nextItemId ? itemsById.get(nextItemId) ?? null : null;
  const isCompleted = shouldCompleteOnQueueEnd && nextItem == null;

  return {
    ...state,
    attempt: {
      ...state.attempt,
      score: state.attempt.score + scoreDelta,
      streak_count: streakCount,
      current_item_index: nextIndex,
      progress: isCompleted ? null : defaultProgress(state.attempt.config_snapshot.trainer_key),
      completed_at: isCompleted ? new Date().toISOString() : null,
      discarded_at: null,
    },
    currentItem: nextItem,
    nextItem: afterNextItemId ? itemsById.get(afterNextItemId) ?? null : null,
    isCompleted,
  };
}
