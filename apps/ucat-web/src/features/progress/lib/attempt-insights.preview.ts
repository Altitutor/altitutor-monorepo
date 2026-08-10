import type { InsightPreviewCase } from "@/features/insights/model/insight-preview";
import type {
  AttemptInsightRuleId,
  AttemptOverallInsightInput,
  AttemptRecentPerformance,
  QuestionAttemptInsightInput,
  QuestionInsightRuleId,
} from "./attempt-insights";

const RECENT: AttemptRecentPerformance = {
  sampleSize: 5,
  accuracyPercent: 70,
  examPacePercent: 100,
  examPaceSampleSize: 5,
  averageTimePerQuestionSeconds: 70,
  averageTimePerQuestionSampleSize: 5,
};

export const ATTEMPT_INSIGHT_PREVIEW_CASES = [
  {
    label: "No accuracy result",
    condition: "The attempt has no scorable accuracy result.",
    input: { accuracyPercent: null },
    expectedRuleId: "attempt.no_accuracy",
  },
  {
    label: "Fast with low accuracy",
    condition:
      "Pace is above 1.10×, accuracy is below 70%, and accuracy has not improved.",
    input: { accuracyPercent: 60, examPacePercent: 120 },
    expectedRuleId: "attempt.fast_low_accuracy",
  },
  {
    label: "Accuracy improved",
    condition:
      "At least three comparable attempts exist and accuracy improved by at least 5 points.",
    input: {
      accuracyPercent: 78,
      examPacePercent: 100,
      recentPerformance: RECENT,
    },
    expectedRuleId: "attempt.accuracy_improved",
  },
  {
    label: "Accuracy declined while pace rose",
    condition:
      "Accuracy fell by at least 5 points and pace rose by at least 8 points against reliable history.",
    input: {
      accuracyPercent: 60,
      examPacePercent: 100,
      recentPerformance: { ...RECENT, examPacePercent: 90 },
    },
    expectedRuleId: "attempt.accuracy_declined_faster",
  },
  {
    label: "Accuracy declined",
    condition:
      "Accuracy fell by at least 5 points without a reliable pace increase.",
    input: {
      accuracyPercent: 60,
      examPacePercent: 100,
      recentPerformance: RECENT,
    },
    expectedRuleId: "attempt.accuracy_declined",
  },
  {
    label: "Strong accuracy without pace",
    condition: "Accuracy is at least 80% and exam pace is unavailable.",
    input: { accuracyPercent: 85 },
    expectedRuleId: "attempt.strong_accuracy_no_pace",
  },
  {
    label: "Strong accuracy and pace",
    condition: "Accuracy is at least 80% and pace is at least 0.90×.",
    input: { accuracyPercent: 85, examPacePercent: 100 },
    expectedRuleId: "attempt.strong_accuracy_balanced",
  },
  {
    label: "Strong accuracy while pace develops",
    condition: "Accuracy is at least 80% and pace is below 0.90×.",
    input: { accuracyPercent: 85, examPacePercent: 80 },
    expectedRuleId: "attempt.strong_accuracy_building_pace",
  },
  {
    label: "Accuracy is the priority",
    condition:
      "Accuracy is below 65% after higher-priority trend and rushing rules are excluded.",
    input: { accuracyPercent: 60, examPacePercent: 85 },
    expectedRuleId: "attempt.accuracy_priority",
  },
  {
    label: "Quicker decisions",
    condition:
      "Accuracy is stable and average question time improved by at least 10% against reliable history.",
    input: {
      accuracyPercent: 70,
      examPacePercent: 100,
      averageTimePerQuestionSeconds: 50,
      recentPerformance: RECENT,
    },
    expectedRuleId: "attempt.decisions_quicker",
  },
  {
    label: "Focused next step",
    condition: "No stronger accuracy, pace, or timing rule matches.",
    input: { accuracyPercent: 70, examPacePercent: 100 },
    expectedRuleId: "attempt.focused_next_step",
  },
] satisfies Array<
  InsightPreviewCase<AttemptOverallInsightInput, AttemptInsightRuleId>
>;

const QUESTION_BASE = {
  timeSpentSeconds: 100,
  averageTimeSeconds: 100,
  averageTimeSampleSize: 10,
  wasFlagged: false,
};

export const QUESTION_INSIGHT_PREVIEW_CASES = [
  {
    label: "Correct without timing evidence",
    condition:
      "The answer is correct but successful cohort timing is not reliable.",
    input: {
      ...QUESTION_BASE,
      result: "correct",
      averageTimeSampleSize: 0,
    },
    expectedRuleId: "question.correct_no_timing",
  },
  {
    label: "Efficient and correct",
    condition:
      "The answer is correct in less than 75% of the reliable successful-answer time.",
    input: { ...QUESTION_BASE, result: "correct", timeSpentSeconds: 50 },
    expectedRuleId: "question.correct_efficient",
  },
  {
    label: "Correct at a comparable pace",
    condition:
      "The answer is correct within 75%–125% of the reliable successful-answer time.",
    input: { ...QUESTION_BASE, result: "correct" },
    expectedRuleId: "question.correct_balanced",
  },
  {
    label: "Correct but slow",
    condition:
      "The answer is correct but takes more than 125% of the reliable successful-answer time.",
    input: { ...QUESTION_BASE, result: "correct", timeSpentSeconds: 140 },
    expectedRuleId: "question.correct_slow",
  },
  {
    label: "Partial and rushed",
    condition:
      "A partial answer takes less than 75% of the reliable successful-answer time.",
    input: { ...QUESTION_BASE, result: "partial", timeSpentSeconds: 50 },
    expectedRuleId: "question.partial_rushed",
  },
  {
    label: "Partial and slow",
    condition:
      "A partial answer takes more than 125% of the reliable successful-answer time.",
    input: { ...QUESTION_BASE, result: "partial", timeSpentSeconds: 140 },
    expectedRuleId: "question.partial_slow",
  },
  {
    label: "Partial at a comparable pace",
    condition: "A partial answer has no extreme reliable timing signal.",
    input: { ...QUESTION_BASE, result: "partial" },
    expectedRuleId: "question.partial_default",
  },
  {
    label: "Unanswered after too long",
    condition:
      "No answer is submitted after more than 125% of the reliable successful-answer time.",
    input: {
      ...QUESTION_BASE,
      result: "not_attempted",
      timeSpentSeconds: 140,
    },
    expectedRuleId: "question.not_attempted_slow",
  },
  {
    label: "Unanswered and flagged",
    condition:
      "No answer is submitted, timing is not excessive, and the question was flagged.",
    input: { ...QUESTION_BASE, result: "not_attempted", wasFlagged: true },
    expectedRuleId: "question.not_attempted_flagged",
  },
  {
    label: "Unanswered without a flag",
    condition: "No answer is submitted without excessive timing or a flag.",
    input: { ...QUESTION_BASE, result: "not_attempted" },
    expectedRuleId: "question.not_attempted_default",
  },
  {
    label: "Incorrect and rushed",
    condition:
      "An incorrect answer takes less than 75% of the reliable successful-answer time.",
    input: { ...QUESTION_BASE, result: "incorrect", timeSpentSeconds: 50 },
    expectedRuleId: "question.incorrect_rushed",
  },
  {
    label: "Incorrect and slow",
    condition:
      "An incorrect answer takes more than 125% of the reliable successful-answer time.",
    input: { ...QUESTION_BASE, result: "incorrect", timeSpentSeconds: 140 },
    expectedRuleId: "question.incorrect_slow",
  },
  {
    label: "Incorrect but usefully flagged",
    condition: "An incorrect answer has workable timing and was flagged.",
    input: { ...QUESTION_BASE, result: "incorrect", wasFlagged: true },
    expectedRuleId: "question.incorrect_flagged",
  },
  {
    label: "Incorrect without timing evidence",
    condition: "An incorrect answer has no reliable successful cohort timing.",
    input: {
      ...QUESTION_BASE,
      result: "incorrect",
      averageTimeSampleSize: 0,
    },
    expectedRuleId: "question.incorrect_no_timing",
  },
  {
    label: "Incorrect at a comparable pace",
    condition:
      "An incorrect answer has workable reliable timing and was not flagged.",
    input: { ...QUESTION_BASE, result: "incorrect" },
    expectedRuleId: "question.incorrect_balanced",
  },
] satisfies Array<
  InsightPreviewCase<QuestionAttemptInsightInput, QuestionInsightRuleId>
>;
