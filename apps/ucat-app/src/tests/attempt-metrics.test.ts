import { test } from "node:test";
import assert from "node:assert/strict";
import { attemptMetrics, formatDuration } from "../features/attempts/metrics";
import type { AttemptDetail, AttemptQuestion } from "../features/attempts/api";
import { buildAttemptOverallInsight } from "../features/progress/attempt-insights";
const question = (timeSpentSeconds: number | null): AttemptQuestion => ({
  questionId: "q",
  questionNumber: 1,
  stemIndex: 1,
  result: "correct",
  score: 1,
  timeSpentSeconds,
  averageTimeSeconds: null,
  averageTimeSampleSize: 0,
  timeBurdenSeconds: null,
  isFlagged: false,
  categoryName: null,
  answerSnapshot: null,
});
const detail = (changes: Partial<AttemptDetail>): AttemptDetail => ({
  id: "a",
  attemptedAt: "2026-09-20T00:00:00Z",
  completedAt: null,
  questionAttempts: [],
  recentPerformance: {
    sampleSize: 0,
    accuracyPercent: null,
    examPacePercent: null,
    examPaceSampleSize: 0,
    averageTimePerQuestionSeconds: null,
    averageTimePerQuestionSampleSize: 0,
  },
  ...changes,
});
test("practice timing distinguishes elapsed session time from measured question time", () => {
  const m = attemptMetrics(
    detail({
      scorePoints: 2,
      totalPoints: 3,
      completedAt: "2026-09-20T00:02:00Z",
      questionAttempts: [question(20), question(40), question(null)],
    }),
  );
  assert.equal(m.duration, 120);
  assert.equal(m.average, 30);
  assert.equal(m.accuracy, (2 / 3) * 100);
});
test("mock raw totals aggregate sections while retaining scaled score independently", () => {
  const m = attemptMetrics(
    detail({
      scaledScore: 2100,
      sets: [
        {
          questionSetName: "VR",
          scorePoints: 20,
          totalPoints: 44,
          scaledScore: 600,
        },
        {
          questionSetName: "SJ",
          scorePoints: 30,
          totalPoints: 40,
          scaledScore: null,
        },
      ],
      timeTakenSeconds: 100,
    }),
  );
  assert.equal(m.score, 50);
  assert.equal(m.maximum, 84);
  assert.equal(m.duration, 100);
});
test("missing timing and scoring remain unknown and time formatting carries rounded minutes", () => {
  const m = attemptMetrics(detail({ questionAttempts: [question(null)] }));
  assert.equal(m.duration, null);
  assert.equal(m.average, null);
  assert.equal(m.accuracy, null);
  assert.equal(formatDuration(null), "—");
  assert.equal(formatDuration(59.8), "1m 0s");
});
test("attempt insight uses actual exam speed", () => {
  assert.equal(
    buildAttemptOverallInsight({ accuracyPercent: 50, examPacePercent: 120 })
      .ruleId,
    "attempt.fast_low_accuracy",
  );
  assert.equal(
    buildAttemptOverallInsight({ accuracyPercent: 85, examPacePercent: 100 })
      .ruleId,
    "attempt.strong_accuracy_balanced",
  );
});
