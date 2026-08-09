import { isAlreadyOnSuggestedActivity } from "@/features/study-plan/lib/companion-mode";

export type AttemptReviewCompanionNotice = {
  id: string;
  eyebrow: string;
  title: string;
  detail: string;
};

export type AttemptReviewCompanionStatus = {
  title: string;
  detail: string;
  actionLabel: string;
};

/** Copy for the floating prompt nudge on attempt result screens. */
export function describeAttemptReviewCompanionNotice(input: {
  remainingCount: number;
}): AttemptReviewCompanionNotice {
  const remaining = Math.max(0, input.remainingCount);
  return {
    id: `attempt-review:${remaining}`,
    eyebrow: "Review this attempt",
    title:
      remaining === 1
        ? "1 question left to review"
        : `${remaining} questions left to review`,
    detail:
      "Review the incorrect, partial, or unanswered questions while the attempt is fresh.",
  };
}

/** Expanded-orb status copy aligned with the attempt insight card. */
export function describeAttemptReviewCompanionStatus(input: {
  viewedCount: number;
  requiredCount: number;
}): AttemptReviewCompanionStatus {
  const required = Math.max(0, input.requiredCount);
  const viewed = Math.min(Math.max(0, input.viewedCount), required);
  return {
    title: "Review this attempt",
    detail: `${viewed} of ${required} incorrect, partial, or unanswered questions viewed.`,
    actionLabel: "Review next incorrect",
  };
}

export function shouldDismissAttemptReviewPrompt(input: {
  landingQuestionIndex: number;
  selectedQuestionIndex: number;
}): boolean {
  return input.selectedQuestionIndex !== input.landingQuestionIndex;
}

/**
 * While guiding in-page review, keep the study-plan / next-step suggestion as
 * the secondary option. If that suggestion already is this review page, use
 * its usual secondary instead of duplicating the current page.
 */
export function selectCompanionSecondaryWhileReviewing<
  T extends { launchPath: string },
>(input: { pathname: string; items: readonly T[] }): T | null {
  const primary = input.items[0];
  if (!primary) return null;
  if (isAlreadyOnSuggestedActivity(input.pathname, primary.launchPath)) {
    return input.items[1] ?? null;
  }
  return primary;
}

export function scrollToAttemptReviewQuestion(input: {
  questionId: string;
  questionAttempts: readonly { questionId: string }[];
  setSelectedQuestionIndex: (index: number) => void;
}): boolean {
  const index = input.questionAttempts.findIndex(
    (question) => question.questionId === input.questionId,
  );
  if (index < 0) return false;
  input.setSelectedQuestionIndex(index);
  document
    .getElementById("attempt-review-questions")
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}
