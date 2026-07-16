import type { QuestionAttemptChartResult } from "./compute-question-attempt-result";
import { formatSpeedPercentAsMultiplier } from "./format-speed-multiplier";

export type AttemptInsightTone = "positive" | "coaching" | "neutral";

export type AttemptInsight = {
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
};

const MIN_RECENT_ATTEMPTS = 3;
const MEANINGFUL_ACCURACY_CHANGE = 5;
const RELIABLE_QUESTION_TIME_SAMPLE = 5;

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
  return ` Your ${formatSpeedPercentAsMultiplier(pacePercent)} exam speed was inside the guide band.`;
}

export function buildAttemptOverallInsight(
  input: AttemptOverallInsightInput,
): AttemptInsight {
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
      title: "This attempt is ready to review",
      body: "Start with the questions you missed or left unanswered. Once more scored evidence is available, this insight will compare accuracy and pace.",
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
      title: "A little less speed may convert more questions",
      body: `You scored ${roundedPercent(accuracy)} while working at ${formatSpeedPercentAsMultiplier(examPace)} exam speed. Slow down on questions you can reasonably solve rather than trying to bank more time across the whole attempt.`,
      tone: "coaching",
    };
  }

  if (accuracyChange != null && accuracyChange >= MEANINGFUL_ACCURACY_CHANGE) {
    return {
      title: "Your accuracy moved in the right direction",
      body: `You reached ${roundedPercent(accuracy)}, up ${Math.round(accuracyChange)} percentage points from your previous ${recent!.sampleSize} comparable attempts.${paceSentence(examPace)}`,
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
          title: "The extra pace may have cost accuracy",
          body: `Accuracy was ${roundedPercent(accuracy)}, ${Math.round(Math.abs(accuracyChange))} points below your previous ${recent!.sampleSize} comparable attempts, while pace was higher. Review the early misses before trying to hold this speed.`,
          tone: "coaching",
        }
      : {
          title: "Use this attempt to find the repeatable misses",
          body: `Accuracy was ${roundedPercent(accuracy)}, ${Math.round(Math.abs(accuracyChange))} points below your previous ${recent!.sampleSize} comparable attempts. Look for one repeated category or reasoning step rather than treating every miss as a separate problem.`,
          tone: "coaching",
        };
  }

  if (accuracy >= 80 && examPace == null) {
    return {
      title: "Strong accuracy to build on",
      body: `You converted ${roundedPercent(accuracy)} of the available marks. Keep reviewing the few misses so the result becomes repeatable.`,
      tone: "positive",
    };
  }

  if (accuracy >= 80 && examPace != null && examPace >= 90) {
    return {
      title: "Accuracy and pace worked well together",
      body: `You converted ${roundedPercent(accuracy)} of the available marks. At ${formatSpeedPercentAsMultiplier(examPace)} exam speed, this is a strong balance to make repeatable.`,
      tone: "positive",
    };
  }

  if (accuracy >= 80 && examPace != null && examPace < 90) {
    return {
      title: "Accuracy is leading your pace",
      body: `You converted ${roundedPercent(accuracy)} of the available marks at ${formatSpeedPercentAsMultiplier(examPace)} exam speed. Keep the method that is working; repeated exposure should make the decisions faster without sacrificing accuracy.`,
      tone: "positive",
    };
  }

  if (accuracy < 65) {
    return {
      title: "Accuracy is the best next lever",
      body: `You converted ${roundedPercent(accuracy)} of the available marks. Review the reasoning behind the misses first; speed becomes more useful once the method is dependable.${
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
        title: "Your decisions were quicker this time",
        body: `Accuracy held at ${roundedPercent(accuracy)} while average question time improved by ${Math.round(Math.abs(timeChange) * 100)}% against your previous ${recent.sampleSize} comparable attempts. Review the misses to make sure the quicker pace stays controlled.`,
        tone: "positive",
      };
    }
  }

  return {
    title: "Turn the misses into a focused next step",
    body: `You converted ${roundedPercent(accuracy)} of the available marks.${paceSentence(examPace)} Start with the most repeated error pattern, then test it again in a short set.`,
    tone: "neutral",
  };
}

export function buildQuestionAttemptInsight(
  input: QuestionAttemptInsightInput,
): AttemptInsight | null {
  const hasReliableTiming =
    input.timeSpentSeconds != null &&
    input.timeSpentSeconds >= 0 &&
    input.averageTimeSeconds != null &&
    input.averageTimeSeconds > 0 &&
    input.averageTimeSampleSize >= RELIABLE_QUESTION_TIME_SAMPLE;
  const timeRatio = hasReliableTiming
    ? input.timeSpentSeconds! / input.averageTimeSeconds!
    : null;

  if (input.result === "correct") {
    if (timeRatio == null) {
      return {
        title: "Nice work",
        body: "You got it right.",
        tone: "positive",
      };
    }
    if (timeRatio < 0.75) {
      return {
        title: "Nicely done",
        body: "Correct, and quicker than the typical time for this question.",
        tone: "positive",
      };
    }
    if (timeRatio <= 1.25) {
      return null;
    }
    return {
      title: "You got there",
      body: "The method worked. Check the explanation for a shorter route if there is one, but let speed follow understanding.",
      tone: "positive",
    };
  }

  if (input.result === "partial") {
    if (timeRatio != null && timeRatio < 0.7) {
      return {
        title: "Close, but a little quick",
        body: "Use the explanation below to find the final check that would have completed the answer.",
        tone: "coaching",
      };
    }
    if (timeRatio != null && timeRatio > 1.5) {
      return {
        title: "Partly there—look for the shorter route",
        body: "The explanation below can show where the method became long or uncertain.",
        tone: "coaching",
      };
    }
    return {
      title: "Close—check the missing step",
      body: "Use the explanation below to see what kept this from full marks.",
      tone: "coaching",
    };
  }

  if (input.result === "not_attempted") {
    return {
      title: "See what made this one worth skipping",
      body: "Read the explanation below, then decide what clue would help you solve, flag, or move on earlier next time.",
      tone: "neutral",
    };
  }

  if (timeRatio != null && timeRatio < 0.7) {
    return {
      title: "This one looks rushed",
      body: "You moved much faster than the typical time. Use the explanation below to spot the check you skipped.",
      tone: "coaching",
    };
  }

  if (timeRatio != null && timeRatio > 1.5) {
    return {
      title: "This one took more time than it returned",
      body: "Use the explanation below to find the intended route, then set an earlier point for moving on if that route is not clear.",
      tone: "coaching",
    };
  }

  if (input.wasFlagged) {
    return {
      title: "Good call to flag this one",
      body: "Now use the explanation below to close the gap you noticed during the attempt.",
      tone: "neutral",
    };
  }

  return null;
}
