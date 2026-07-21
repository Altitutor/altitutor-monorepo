export type UcatContentRatingTargetType =
  | "answer_explanation"
  | "question_insight"
  | "attempt_insight"
  | "progress_insight"
  | "dashboard_insight";

export type UcatContentRatingSurface = "dashboard" | "progress" | "attempt";

export type UcatContentRatingReason =
  | "inaccurate"
  | "unclear"
  | "not_relevant"
  | "too_generic"
  | "timing_advice_wrong"
  | "skips_steps"
  | "too_long"
  | "other";

export type UcatContentRatingDescriptor = {
  targetType: UcatContentRatingTargetType;
  targetKey: string;
  targetVersion: string;
  contextKey: string;
  surface: UcatContentRatingSurface;
  displayedContent: Record<string, string>;
};

export type UcatContentRatingValue = {
  vote: -1 | 1;
  reasonCode: UcatContentRatingReason | null;
  reasonText: string | null;
};
