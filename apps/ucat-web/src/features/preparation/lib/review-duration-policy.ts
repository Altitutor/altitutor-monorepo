export type ReviewDurationComponent = {
  questionCount: number;
  examTimePerQuestionSeconds: number;
  expectedAccuracy: number | null;
};

const CORRECT_REVIEW_FRACTION = 0.1;
const INCORRECT_REVIEW_FRACTION = 0.2;
const UNKNOWN_ACCURACY_REVIEW_FRACTION = 0.15;

function reviewFraction(expectedAccuracy: number | null): number {
  if (expectedAccuracy == null || !Number.isFinite(expectedAccuracy)) {
    return UNKNOWN_ACCURACY_REVIEW_FRACTION;
  }
  const accuracy = Math.max(0, Math.min(1, expectedAccuracy));
  return (
    accuracy * CORRECT_REVIEW_FRACTION +
    (1 - accuracy) * INCORRECT_REVIEW_FRACTION
  );
}

export function estimateQuestionReviewMinutes(
  components: ReviewDurationComponent[],
): number {
  const seconds = components.reduce(
    (sum, component) =>
      sum +
      Math.max(0, component.questionCount) *
        Math.max(0, component.examTimePerQuestionSeconds) *
        reviewFraction(component.expectedAccuracy),
    0,
  );
  return Math.max(1, Math.ceil(seconds / 60));
}

export function estimatedReviewSecondsPerQuestion(input: {
  examTimePerQuestionSeconds: number;
  expectedAccuracy: number | null;
}): number {
  return (
    Math.max(0, input.examTimePerQuestionSeconds) *
    reviewFraction(input.expectedAccuracy)
  );
}
