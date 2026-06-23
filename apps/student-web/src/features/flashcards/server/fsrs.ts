import { createEmptyCard, fsrs, Rating, State, type Card, type CardInput } from 'ts-fsrs';
import type { FlashcardRating, FlashcardRatingPreview } from '@altitutor/shared';

export const scheduler = fsrs();

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

function previewForRating(state: ReviewStateRow | null, now: Date, rating: FlashcardRating): FlashcardRatingPreview {
  const result = scheduler.next(toFsrsCard(state, now), now, ratingMap[rating]);
  return {
    due_at: result.card.due.toISOString(),
    label: formatDueInterval(result.card.due, now),
  };
}

export function buildRatingPreviews(state: ReviewStateRow | null, now = new Date()) {
  return {
    again: previewForRating(state, now, 'again'),
    hard: previewForRating(state, now, 'hard'),
    good: previewForRating(state, now, 'good'),
    easy: previewForRating(state, now, 'easy'),
  };
}
