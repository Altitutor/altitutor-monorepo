import type { QuestionAttemptChartResult } from "./compute-question-attempt-result";
import { formatSpeedPercentAsMultiplier } from "./format-speed-multiplier";

export type AttemptInsightTone = "positive" | "coaching" | "neutral";

export const ATTEMPT_INSIGHT_RULE_IDS = [
  "attempt.no_accuracy",
  "attempt.fast_low_accuracy",
  "attempt.accuracy_improved",
  "attempt.accuracy_declined_faster",
  "attempt.accuracy_declined",
  "attempt.strong_accuracy_no_pace",
  "attempt.strong_accuracy_balanced",
  "attempt.strong_accuracy_building_pace",
  "attempt.accuracy_priority",
  "attempt.decisions_quicker",
  "attempt.focused_next_step",
] as const;

export const QUESTION_INSIGHT_RULE_IDS = [
  "question.correct_no_timing",
  "question.correct_efficient",
  "question.correct_balanced",
  "question.correct_slow",
  "question.partial_rushed",
  "question.partial_slow",
  "question.partial_default",
  "question.not_attempted_slow",
  "question.not_attempted_flagged",
  "question.not_attempted_default",
  "question.incorrect_rushed",
  "question.incorrect_slow",
  "question.incorrect_flagged",
  "question.incorrect_no_timing",
  "question.incorrect_balanced",
] as const;

export type AttemptInsightRuleId = (typeof ATTEMPT_INSIGHT_RULE_IDS)[number];
export type QuestionInsightRuleId = (typeof QUESTION_INSIGHT_RULE_IDS)[number];

export type AttemptInsight = {
  ruleId: AttemptInsightRuleId | QuestionInsightRuleId;
  title: string;
  body: string;
  tone: AttemptInsightTone;
};

export type AttemptRecentPerformance = {
  sampleSize: number;
  accuracyPercent: number | null;
  examPacePercent: number | null;
  examPaceSampleSize: number;
  averageTimePerQuestionSeconds: number | null;
  averageTimePerQuestionSampleSize: number;
};

export type AttemptOverallInsightInput = {
  accuracyPercent: number | null;
  examPacePercent?: number | null;
  averageTimePerQuestionSeconds?: number | null;
  recentPerformance?: AttemptRecentPerformance | null;
};

export type QuestionAttemptInsightInput = {
  result: QuestionAttemptChartResult;
  timeSpentSeconds: number | null;
  averageTimeSeconds: number | null;
  averageTimeSampleSize: number;
  wasFlagged?: boolean;
  wrongAnswerExplanations?: readonly string[];
};

const MIN_RECENT_ATTEMPTS = 3;
const MEANINGFUL_ACCURACY_CHANGE = 5;
const RELIABLE_QUESTION_TIME_SAMPLE = 5;
const QUICK_QUESTION_TIME_RATIO = 0.75;
const SLOW_QUESTION_TIME_RATIO = 1.25;

function roundedPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function paceSentence(pacePercent: number | null | undefined): string {
  if (pacePercent == null) return "";
  if (pacePercent > 110) {
    return ` You worked at ${formatSpeedPercentAsMultiplier(pacePercent)} exam speed, so check that the extra speed is not creating avoidable misses.`;
  }
  if (pacePercent < 90) {
    return ` You worked at ${formatSpeedPercentAsMultiplier(pacePercent)} exam speed; keep the sound reasoning and let familiarity build the speed.`;
  }
  return ` Your ${formatSpeedPercentAsMultiplier(pacePercent)} exam speed was around exam pace.`;
}

function selectedAnswerFeedback(
  input: QuestionAttemptInsightInput,
  fallback: string,
): string {
  const explanations = (input.wrongAnswerExplanations ?? [])
    .map((explanation) => explanation.trim())
    .filter(Boolean);
  if (explanations.length === 0) return fallback;
  if (explanations.length === 1) {
    return `For the answer you chose: ${explanations[0]}`;
  }
  return `For the answers that missed:\n${explanations
    .map((explanation) => `• ${explanation}`)
    .join("\n")}`;
}

export function buildAttemptOverallInsight(
  input: AttemptOverallInsightInput,
): AttemptInsight & { ruleId: AttemptInsightRuleId } {
  const accuracy = input.accuracyPercent;
  const examPace = input.examPacePercent;
  const recent = input.recentPerformance;
  const hasRecentEvidence =
    recent != null && recent.sampleSize >= MIN_RECENT_ATTEMPTS;
  const accuracyChange =
    accuracy != null && hasRecentEvidence && recent.accuracyPercent != null
      ? accuracy - recent.accuracyPercent
      : null;

  if (accuracy == null) {
    return {
      ruleId: "attempt.no_accuracy",
      title: "Start with the questions that cost the most",
      body: "Review unanswered and incorrect questions in order of time spent. For each one, identify whether the issue was the method, a missed clue, or the decision to keep going.",
      tone: "neutral",
    };
  }

  if (
    examPace != null &&
    examPace > 110 &&
    accuracy < 70 &&
    (accuracyChange == null || accuracyChange <= 0)
  ) {
    return {
      ruleId: "attempt.fast_low_accuracy",
      title: "A little less speed may help you get more questions right",
      body: `You scored ${roundedPercent(accuracy)} while working at ${formatSpeedPercentAsMultiplier(examPace)} exam speed. Slow down on questions you can reasonably solve rather than trying to save more time across the whole attempt.`,
      tone: "coaching",
    };
  }

  if (accuracyChange != null && accuracyChange >= MEANINGFUL_ACCURACY_CHANGE) {
    return {
      ruleId: "attempt.accuracy_improved",
      title: "Your accuracy moved in the right direction",
      body: `You reached ${roundedPercent(accuracy)}, up ${Math.round(accuracyChange)} percentage points from your previous ${recent!.sampleSize} similar attempts.${paceSentence(examPace)}`,
      tone: "positive",
    };
  }

  if (accuracyChange != null && accuracyChange <= -MEANINGFUL_ACCURACY_CHANGE) {
    const fasterThanRecent =
      examPace != null &&
      recent?.examPacePercent != null &&
      recent.examPaceSampleSize >= MIN_RECENT_ATTEMPTS &&
      examPace >= recent.examPacePercent + 8;
    return fasterThanRecent
      ? {
          ruleId: "attempt.accuracy_declined_faster",
          title: "The extra pace may have cost accuracy",
          body: `Accuracy was ${roundedPercent(accuracy)}, ${Math.round(Math.abs(accuracyChange))} points below your previous ${recent!.sampleSize} similar attempts, while pace was higher. Review the early misses before trying to hold this speed.`,
          tone: "coaching",
        }
      : {
          ruleId: "attempt.accuracy_declined",
          title: "Use this attempt to find the repeatable misses",
          body: `Accuracy was ${roundedPercent(accuracy)}, ${Math.round(Math.abs(accuracyChange))} points below your previous ${recent!.sampleSize} similar attempts. Look for one repeated category or reasoning step rather than treating every miss as a separate problem.`,
          tone: "coaching",
        };
  }

  if (accuracy >= 80 && examPace == null) {
    return {
      ruleId: "attempt.strong_accuracy_no_pace",
      title: "Strong accuracy to build on",
      body: `You scored ${roundedPercent(accuracy)}. Keep reviewing the few misses so the result becomes repeatable.`,
      tone: "positive",
    };
  }

  if (accuracy >= 80 && examPace != null && examPace >= 90) {
    return {
      ruleId: "attempt.strong_accuracy_balanced",
      title: "Accuracy and pace worked well together",
      body: `You scored ${roundedPercent(accuracy)}. At ${formatSpeedPercentAsMultiplier(examPace)} exam speed, this is a strong balance to make repeatable.`,
      tone: "positive",
    };
  }

  if (accuracy >= 80 && examPace != null && examPace < 90) {
    return {
      ruleId: "attempt.strong_accuracy_building_pace",
      title: "Accuracy is leading your pace",
      body: `You scored ${roundedPercent(accuracy)} at ${formatSpeedPercentAsMultiplier(examPace)} exam speed. Keep the method that is working; repeated exposure should make the decisions faster without sacrificing accuracy.`,
      tone: "positive",
    };
  }

  if (accuracy < 65) {
    return {
      ruleId: "attempt.accuracy_priority",
      title: "Accuracy is the best next focus",
      body: `You scored ${roundedPercent(accuracy)}. Review the reasoning behind the misses first; speed becomes more useful once the method is dependable.${
        examPace != null && examPace < 90
          ? " It is normal for pace to build later."
          : ""
      }`,
      tone: "coaching",
    };
  }

  if (
    input.averageTimePerQuestionSeconds != null &&
    hasRecentEvidence &&
    recent.averageTimePerQuestionSeconds != null &&
    recent.averageTimePerQuestionSampleSize >= MIN_RECENT_ATTEMPTS
  ) {
    const timeChange =
      (input.averageTimePerQuestionSeconds -
        recent.averageTimePerQuestionSeconds) /
      recent.averageTimePerQuestionSeconds;
    if (timeChange <= -0.1) {
      return {
        ruleId: "attempt.decisions_quicker",
        title: "Your decisions were quicker this time",
        body: `Accuracy held at ${roundedPercent(accuracy)} while average question time improved by ${Math.round(Math.abs(timeChange) * 100)}% against your previous ${recent.sampleSize} similar attempts. Review the misses to make sure the quicker pace stays controlled.`,
        tone: "positive",
      };
    }
  }

  return {
    ruleId: "attempt.focused_next_step",
    title: "Turn the misses into a focused next step",
    body: `You scored ${roundedPercent(accuracy)}.${paceSentence(examPace)} Start with the most repeated error pattern, then test it again in a short set.`,
    tone: "neutral",
  };
}

export function buildQuestionAttemptInsight(
  input: QuestionAttemptInsightInput,
): AttemptInsight & { ruleId: QuestionInsightRuleId } {
  const hasReliableTiming =
    input.timeSpentSeconds != null &&
    input.timeSpentSeconds > 0 &&
    input.averageTimeSeconds != null &&
    input.averageTimeSeconds > 0 &&
    input.averageTimeSampleSize >= RELIABLE_QUESTION_TIME_SAMPLE;
  const timeRatio = hasReliableTiming
    ? input.timeSpentSeconds! / input.averageTimeSeconds!
    : null;

  if (input.result === "correct") {
    if (timeRatio == null) {
      return {
        ruleId: "question.correct_no_timing",
        title: "Correct — check what made it work",
        body: "Check the explanation for what made the difference, then keep the approach that got you there.",
        tone: "positive",
      };
    }
    if (timeRatio < QUICK_QUESTION_TIME_RATIO) {
      return {
        ruleId: "question.correct_efficient",
        title: "Efficient and correct",
        body: `You answered ${Math.round((1 - timeRatio) * 100)}% faster than the average student who got this question right. Make sure the speed came from a method you can repeat.`,
        tone: "positive",
      };
    }
    if (timeRatio <= SLOW_QUESTION_TIME_RATIO) {
      return {
        ruleId: "question.correct_balanced",
        title: "Correct at a solid pace",
        body: "You got the question right in about the same time as other students who answered it correctly. Review the method briefly, then move on.",
        tone: "positive",
      };
    }
    return {
      ruleId: "question.correct_slow",
      title: "Correct, but slower than it needed to be",
      body: `You took ${Math.round((timeRatio - 1) * 100)}% longer than the average student who got this question right. Keep the sound reasoning, but check the explanation for a shorter route.`,
      tone: "positive",
    };
  }

  if (input.result === "partial") {
    if (timeRatio != null && timeRatio < QUICK_QUESTION_TIME_RATIO) {
      return {
        ruleId: "question.partial_rushed",
        title: "Almost — you may have moved on too soon",
        body: `You were ${Math.round((1 - timeRatio) * 100)}% faster than students who got this question right. ${selectedAnswerFeedback(input, "Use the explanation to find what would have completed the answer.")}`,
        tone: "coaching",
      };
    }
    if (timeRatio != null && timeRatio > SLOW_QUESTION_TIME_RATIO) {
      return {
        ruleId: "question.partial_slow",
        title: "Partly right, and it took longer than it should",
        body: `You took ${Math.round((timeRatio - 1) * 100)}% longer than students who got this question right. ${selectedAnswerFeedback(input, "The explanation can show where your approach became long or uncertain.")}`,
        tone: "coaching",
      };
    }
    return {
      ruleId: "question.partial_default",
      title: "Close — see what kept this from full marks",
      body: selectedAnswerFeedback(
        input,
        "Use the explanation below to see what kept this from full marks.",
      ),
      tone: "coaching",
    };
  }

  if (input.result === "not_attempted") {
    if (timeRatio != null && timeRatio > SLOW_QUESTION_TIME_RATIO) {
      return {
        ruleId: "question.not_attempted_slow",
        title: "You spent too long without answering",
        body: `You spent ${Math.round((timeRatio - 1) * 100)}% longer than the average successful time without submitting an answer. Decide earlier whether to commit, flag, or move on.`,
        tone: "coaching",
      };
    }
    if (input.wasFlagged) {
      return {
        ruleId: "question.not_attempted_flagged",
        title: "You flagged this — check what made it hard",
        body: "Use the explanation to identify the clue that would let you solve or skip this question decisively next time.",
        tone: "neutral",
      };
    }
    return {
      ruleId: "question.not_attempted_default",
      title: "Decide earlier: solve, flag, or move on",
      body: "Use the explanation to identify the clue that would help you solve, flag, or move on earlier next time.",
      tone: "neutral",
    };
  }

  if (timeRatio != null && timeRatio < QUICK_QUESTION_TIME_RATIO) {
    return {
      ruleId: "question.incorrect_rushed",
      title: "You answered too quickly and got it wrong",
      body: `You were ${Math.round((1 - timeRatio) * 100)}% faster than students who got this question right. ${selectedAnswerFeedback(input, "Use the explanation to spot the check or reasoning you skipped.")}`,
      tone: "coaching",
    };
  }

  if (timeRatio != null && timeRatio > SLOW_QUESTION_TIME_RATIO) {
    return {
      ruleId: "question.incorrect_slow",
      title: "You spent too long and still got it wrong",
      body: `You took ${Math.round((timeRatio - 1) * 100)}% longer than students who got this question right. ${selectedAnswerFeedback(input, "Learn the intended method from the explanation.")} Next time, decide earlier to move on when that method is not clear.`,
      tone: "coaching",
    };
  }

  if (input.wasFlagged) {
    return {
      ruleId: "question.incorrect_flagged",
      title: "Good call to flag this one",
      body: selectedAnswerFeedback(
        input,
        "Now use the explanation below to see what you were unsure about.",
      ),
      tone: "neutral",
    };
  }

  const noTiming = timeRatio == null;

  return {
    ruleId: noTiming
      ? "question.incorrect_no_timing"
      : "question.incorrect_balanced",
    title: noTiming
      ? "Find where your approach went wrong"
      : "Your timing was fine — the reasoning needs work",
    body: noTiming
      ? `${selectedAnswerFeedback(input, "Compare your approach with the explanation and find the first point where they diverged.")} Redo the question from there before moving on.`
      : `You used about the same amount of time as students who got this question right. ${selectedAnswerFeedback(input, "Use the explanation to find where your reasoning diverged.")}`,
    tone: "coaching",
  };
}
