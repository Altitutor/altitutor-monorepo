import type { PracticeReviewTiming } from "@/features/practice/lib/session-storage";

export type PracticeTimingScope = "untimed" | "stem" | "session" | "invalid";

export function resolvePracticeTimingScope({
  timePerQuestionSeconds,
  unlimited,
  reviewTiming,
}: {
  timePerQuestionSeconds: number | null | undefined;
  unlimited: boolean;
  reviewTiming: PracticeReviewTiming;
}): PracticeTimingScope {
  if (timePerQuestionSeconds == null || timePerQuestionSeconds <= 0) {
    return "untimed";
  }
  if (reviewTiming === "afterEachStem") return "stem";
  return unlimited ? "invalid" : "session";
}

export function calculatePracticeSessionTimeLimitSeconds(
  timePerQuestionSeconds: number,
  deliveredQuestionCount: number,
): number {
  return Math.round(
    Math.max(0, timePerQuestionSeconds) * Math.max(0, deliveredQuestionCount),
  );
}

function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const hours = Math.floor(rounded / 3_600);
  const minutes = Math.floor((rounded % 3_600) / 60);
  const remainingSeconds = rounded % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function formatSeconds(seconds: number): string {
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
}

export function getPracticeTimingSummaryLabel({
  timePerQuestionSeconds,
  unlimited,
  reviewTiming,
  questionCount,
}: {
  timePerQuestionSeconds: number | null | undefined;
  unlimited: boolean;
  reviewTiming: PracticeReviewTiming;
  questionCount: number;
}): string {
  const scope = resolvePracticeTimingScope({
    timePerQuestionSeconds,
    unlimited,
    reviewTiming,
  });
  if (scope === "untimed") return "No time limit";
  if (scope === "invalid") return "Requires a fixed question count";
  if (scope === "stem") {
    return `${formatSeconds(timePerQuestionSeconds!)} sec per question · timed per stem`;
  }
  const total = calculatePracticeSessionTimeLimitSeconds(
    timePerQuestionSeconds!,
    questionCount,
  );
  return `${formatDuration(total)} total (${questionCount} questions)`;
}
