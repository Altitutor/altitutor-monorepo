export const UCAT_INTEREST_KINDS = [
  "supported_access",
  "online_tutoring_waitlist",
  "interview_training_waitlist",
] as const;

export type UcatInterestKind = (typeof UCAT_INTEREST_KINDS)[number];

export function isSupportedAccessKind(kind: UcatInterestKind) {
  return kind === "supported_access";
}

export function isWaitlistKind(kind: UcatInterestKind) {
  return kind === "online_tutoring_waitlist" || kind === "interview_training_waitlist";
}
