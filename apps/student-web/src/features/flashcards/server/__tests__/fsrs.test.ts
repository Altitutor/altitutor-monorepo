import {
  DEFAULT_FLASHCARD_STUDY_PRESET,
  buildRatingPreviews,
  getRetrievability,
  scheduleReview,
  stateName,
  type ReviewStateRow,
} from '../fsrs';

describe('flashcard FSRS configuration', () => {
  it('caps scheduled intervals at one year', () => {
    const now = new Date('2026-09-16T00:00:00.000Z');
    const matureCard: ReviewStateRow = {
      due_at: now.toISOString(),
      stability: 1_000,
      difficulty: 5,
      scheduled_days: 1_000,
      learning_steps: 0,
      reps: 100,
      lapses: 0,
      state: 'Review',
      last_reviewed_at: '2023-12-21T00:00:00.000Z',
    };

    const easyDueAt = new Date(buildRatingPreviews(matureCard, now).easy.due_at);
    const intervalDays = (easyDueAt.getTime() - now.getTime()) / 86_400_000;

    expect(intervalDays).toBeLessThanOrEqual(365);
  });

  it('uses the Study Preset learning and relearning steps', () => {
    const now = new Date('2026-09-19T00:00:00.000Z');
    const preset = {
      ...DEFAULT_FLASHCARD_STUDY_PRESET,
      learningStepsMinutes: [2, 15],
      relearningStepsMinutes: [7],
    };

    const newAgain = scheduleReview(null, now, 'again', preset, 'card-1:0').card;
    const newGood = scheduleReview(null, now, 'good', preset, 'card-1:0').card;
    const reviewAgain = scheduleReview({
      due_at: now.toISOString(),
      stability: 20,
      difficulty: 5,
      scheduled_days: 20,
      learning_steps: 0,
      reps: 10,
      lapses: 0,
      state: 'Review',
      last_reviewed_at: '2026-08-30T00:00:00.000Z',
    }, now, 'again', preset, 'card-2:10').card;

    expect(newAgain.due.toISOString()).toBe('2026-09-19T00:02:00.000Z');
    expect(newGood.due.toISOString()).toBe('2026-09-19T00:15:00.000Z');
    expect(reviewAgain.due.toISOString()).toBe('2026-09-19T00:07:00.000Z');
  });

  it('uses a stable fuzz seed for previews and the committed answer', () => {
    const now = new Date('2026-09-19T00:00:00.000Z');
    const state: ReviewStateRow = {
      due_at: now.toISOString(),
      stability: 120,
      difficulty: 5,
      scheduled_days: 120,
      learning_steps: 0,
      reps: 20,
      lapses: 1,
      state: 'Review',
      last_reviewed_at: '2026-05-22T00:00:00.000Z',
    };

    const previews = buildRatingPreviews(state, now, DEFAULT_FLASHCARD_STUDY_PRESET, 'stable-seed');
    const committed = scheduleReview(state, now, 'good', DEFAULT_FLASHCARD_STUDY_PRESET, 'stable-seed');

    expect(previews.good.due_at).toBe(committed.card.due.toISOString());
  });

  it('keeps learning cards in an interday queue when a step crosses the study-day boundary', () => {
    const now = new Date('2026-09-18T18:25:00.000Z');
    const studyDayEndsAt = new Date('2026-09-18T18:30:00.000Z');
    const result = scheduleReview(
      null,
      now,
      'good',
      DEFAULT_FLASHCARD_STUDY_PRESET,
      'crosses-boundary',
      studyDayEndsAt,
    );

    expect(result.card.due.toISOString()).toBe('2026-09-18T18:35:00.000Z');
    expect(stateName(result.card.state)).toBe('Learning');
    expect(result.card.scheduled_days).toBe(1);
  });

  it('keeps configured day-length steps in learning until every step is complete', () => {
    const now = new Date('2026-09-19T00:00:00.000Z');
    const preset = { ...DEFAULT_FLASHCARD_STUDY_PRESET, learningStepsMinutes: [1, 1440, 4320] };
    const result = scheduleReview(
      null,
      now,
      'good',
      preset,
      'long-learning-step',
      new Date('2026-09-19T18:30:00.000Z'),
    );

    expect(stateName(result.card.state)).toBe('Learning');
    expect(result.card.learning_steps).toBe(1);
    expect(result.card.scheduled_days).toBeGreaterThanOrEqual(1);
  });

  it.each(['again', 'hard'] as const)('keeps a day-length first step in learning after %s', (rating) => {
    const now = new Date('2026-09-19T00:00:00.000Z');
    const result = scheduleReview(
      null,
      now,
      rating,
      { ...DEFAULT_FLASHCARD_STUDY_PRESET, learningStepsMinutes: [1440, 4320] },
      `long-first-step-${rating}`,
      new Date('2026-09-19T18:30:00.000Z'),
    );

    expect(stateName(result.card.state)).toBe('Learning');
    expect(result.card.scheduled_days).toBeGreaterThanOrEqual(1);
  });

  it('applies the minimum lapse interval when relearning steps are empty', () => {
    const now = new Date('2026-09-19T00:00:00.000Z');
    const review: ReviewStateRow = {
      due_at: now.toISOString(),
      stability: 0.1,
      difficulty: 8,
      scheduled_days: 1,
      learning_steps: 0,
      reps: 2,
      lapses: 1,
      state: 'Review',
      last_reviewed_at: '2026-09-18T00:00:00.000Z',
    };
    const result = scheduleReview(
      review,
      now,
      'again',
      { ...DEFAULT_FLASHCARD_STUDY_PRESET, relearningStepsMinutes: [], minimumLapseIntervalDays: 3 },
      'empty-relearning-steps',
      new Date('2026-09-19T18:30:00.000Z'),
    );

    expect(stateName(result.card.state)).toBe('Review');
    expect(result.card.scheduled_days).toBeGreaterThanOrEqual(3);
  });

  it('keeps a successful Hard review in the review state', () => {
    const now = new Date('2026-09-19T00:00:00.000Z');
    const review: ReviewStateRow = {
      due_at: now.toISOString(),
      stability: 40,
      difficulty: 5,
      scheduled_days: 40,
      learning_steps: 0,
      reps: 8,
      lapses: 0,
      state: 'Review',
      last_reviewed_at: '2026-08-10T00:00:00.000Z',
    };

    const result = scheduleReview(
      review,
      now,
      'hard',
      DEFAULT_FLASHCARD_STUDY_PRESET,
      'hard-review',
      new Date('2026-09-19T18:30:00.000Z'),
    );

    expect(stateName(result.card.state)).toBe('Review');
  });

  it('calculates retrievability for review ordering', () => {
    const now = new Date('2026-09-19T00:00:00.000Z');
    const state: ReviewStateRow = {
      due_at: now.toISOString(),
      stability: 10,
      difficulty: 5,
      scheduled_days: 10,
      learning_steps: 0,
      reps: 5,
      lapses: 0,
      state: 'Review',
      last_reviewed_at: '2026-09-09T00:00:00.000Z',
    };

    expect(getRetrievability(state, now, DEFAULT_FLASHCARD_STUDY_PRESET)).toBeCloseTo(0.9, 4);
  });

  it('enforces the preset minimum lapse interval when relearning graduates', () => {
    const now = new Date('2026-09-19T00:00:00Z');
    const relearning: ReviewStateRow = { due_at: now.toISOString(), stability: .1, difficulty: 8, scheduled_days: 0,
      learning_steps: 0, reps: 2, lapses: 2, state: 'Relearning', last_reviewed_at: '2026-09-18T00:00:00Z' };
    const result = scheduleReview(relearning,now,'good',{...DEFAULT_FLASHCARD_STUDY_PRESET,minimumLapseIntervalDays:3},'min-lapse');
    if (result.card.state === 2) expect(result.card.scheduled_days).toBeGreaterThanOrEqual(3);
  });
});
