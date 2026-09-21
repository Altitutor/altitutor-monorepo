import {
  createEmptyCard,
  default_w,
  fsrs,
  FSRSVersion,
  Rating,
  State,
  StrategyMode,
  type Card,
  type CardInput,
  type StepUnit,
} from 'ts-fsrs';
import type { FlashcardRating, FlashcardRatingPreview } from '@altitutor/shared';

const maximumIntervalDays = 365;

export const flashcardSchedulerVersion = `ts-fsrs:${FSRSVersion}`;

export type FlashcardStudyPresetConfig = {
  desiredRetention: number;
  learningStepsMinutes: number[];
  relearningStepsMinutes: number[];
  minimumLapseIntervalDays: number;
  fsrsParameters: number[];
};

export const DEFAULT_FLASHCARD_STUDY_PRESET: FlashcardStudyPresetConfig = {
  desiredRetention: 0.9,
  learningStepsMinutes: [1, 10],
  relearningStepsMinutes: [10],
  minimumLapseIntervalDays: 1,
  fsrsParameters: [...default_w],
};

export const ratingMap: Record<FlashcardRating, Rating.Again | Rating.Hard | Rating.Good | Rating.Easy> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export type ReviewStateRow = {
  due_at: string;
  stability: number | null;
  difficulty: number | null;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: 'New' | 'Learning' | 'Review' | 'Relearning';
  last_reviewed_at: string | null;
};

export function stateName(state: State): ReviewStateRow['state'] {
  return State[state] as ReviewStateRow['state'];
}

export function toFsrsCard(state: ReviewStateRow | null, now: Date): CardInput | Card {
  if (!state) return createEmptyCard(now);
  if (state.state === 'New' && state.stability == null && state.difficulty == null) {
    return createEmptyCard(now);
  }
  return {
    due: state.due_at,
    stability: Number(state.stability ?? 0),
    difficulty: Number(state.difficulty ?? 0),
    elapsed_days: 0,
    scheduled_days: state.scheduled_days ?? 0,
    learning_steps: state.learning_steps ?? 0,
    reps: state.reps ?? 0,
    lapses: state.lapses ?? 0,
    state: state.state,
    last_review: state.last_reviewed_at,
  };
}

function minuteSteps(minutes: number[]): StepUnit[] {
  return minutes.map((minute) => `${minute}m` as StepUnit);
}

function createScheduler(preset: FlashcardStudyPresetConfig, fuzzSeed: string) {
  return fsrs({
    request_retention: preset.desiredRetention,
    maximum_interval: maximumIntervalDays,
    w: preset.fsrsParameters,
    enable_fuzz: true,
    enable_short_term: true,
    learning_steps: minuteSteps(preset.learningStepsMinutes),
    relearning_steps: minuteSteps(preset.relearningStepsMinutes),
  }).useStrategy(StrategyMode.SEED, () => fuzzSeed);
}

export function scheduleReview(
  state: ReviewStateRow | null,
  now: Date,
  rating: FlashcardRating,
  preset: FlashcardStudyPresetConfig = DEFAULT_FLASHCARD_STUDY_PRESET,
  fuzzSeed = now.toISOString(),
  studyDayEndsAt?: Date,
) {
  const scheduler = createScheduler(preset, fuzzSeed);
  const result = scheduler.next(toFsrsCard(state, now), now, ratingMap[rating]);

  const usesRelearningSteps = state?.state === 'Relearning'
    || (state?.state === 'Review' && rating === 'again');
  const usesLearningSteps = !state || state.state === 'New' || state.state === 'Learning';
  const steps = usesRelearningSteps
    ? preset.relearningStepsMinutes
    : usesLearningSteps
      ? preset.learningStepsMinutes
      : [];
  const learningState = usesRelearningSteps ? State.Relearning : State.Learning;
  const shouldRemainInSteps = rating === 'again'
    || rating === 'hard'
    || (rating === 'good' && result.card.learning_steps > 0 && result.card.learning_steps < steps.length);
  if (steps.length > 0 && shouldRemainInSteps && result.card.state === State.Review) {
    result.card.state = learningState;
  }

  if (
    studyDayEndsAt
    && (result.card.state === State.Learning || result.card.state === State.Relearning)
    && result.card.due >= studyDayEndsAt
  ) {
    result.card.scheduled_days = Math.max(1, result.card.scheduled_days);
  }

  const isLapseGraduation = (state?.state === 'Review' && rating === 'again')
    || state?.state === 'Relearning';
  if (isLapseGraduation && stateName(result.card.state) === 'Review' && result.card.scheduled_days < preset.minimumLapseIntervalDays) {
    result.card.scheduled_days = preset.minimumLapseIntervalDays;
    result.card.due = new Date(now.getTime() + preset.minimumLapseIntervalDays * 86_400_000);
  }

  // ts-fsrs can add one or two days after applying maximum_interval to keep
  // Hard < Good < Easy. Enforce the product-level cap on the persisted card.
  if (result.card.scheduled_days > maximumIntervalDays) {
    result.card.scheduled_days = maximumIntervalDays;
    result.card.due = new Date(now.getTime() + maximumIntervalDays * 86_400_000);
  }

  return result;
}

export function getRetrievability(
  state: ReviewStateRow,
  now: Date,
  preset: FlashcardStudyPresetConfig = DEFAULT_FLASHCARD_STUDY_PRESET,
): number {
  return createScheduler(preset, 'retrievability').get_retrievability(toFsrsCard(state, now), now, false);
}

function formatDueInterval(due: Date, now: Date): string {
  const minutes = Math.max(0, Math.round((due.getTime() - now.getTime()) / 60_000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo`;
  return `${Math.round(days / 365)}y`;
}

function previewForRating(
  state: ReviewStateRow | null,
  now: Date,
  rating: FlashcardRating,
  preset: FlashcardStudyPresetConfig,
  fuzzSeed: string,
  studyDayEndsAt?: Date,
): FlashcardRatingPreview {
  const result = scheduleReview(state, now, rating, preset, fuzzSeed, studyDayEndsAt);
  return {
    due_at: result.card.due.toISOString(),
    label: formatDueInterval(result.card.due, now),
  };
}

export function buildRatingPreviews(
  state: ReviewStateRow | null,
  now = new Date(),
  preset: FlashcardStudyPresetConfig = DEFAULT_FLASHCARD_STUDY_PRESET,
  fuzzSeed = now.toISOString(),
  studyDayEndsAt?: Date,
) {
  return {
    again: previewForRating(state, now, 'again', preset, fuzzSeed, studyDayEndsAt),
    hard: previewForRating(state, now, 'hard', preset, fuzzSeed, studyDayEndsAt),
    good: previewForRating(state, now, 'good', preset, fuzzSeed, studyDayEndsAt),
    easy: previewForRating(state, now, 'easy', preset, fuzzSeed, studyDayEndsAt),
  };
}
