export type AttemptReviewType =
  | "practice_session"
  | "set_attempt"
  | "mock_attempt";

export type AttemptReviewState = {
  requiredQuestionIds: string[];
  viewedQuestionIds: string[];
  completedAt: string | null;
  completionMethod: "automatic" | "manual" | null;
};
