import type { UcatOnlineTier } from "@altitutor/shared";

export type { UcatOnlineTier };

export type UcatQuotaArea =
  | "practice"
  | "sets"
  | "mocks"
  | "learn"
  | "skill_trainer";

export type UcatQuotaPeriod = "day" | "week" | "month";

export type UcatQuotaAreaUsage = {
  area: UcatQuotaArea;
  label: string;
  used: number;
  limit: number;
  period: UcatQuotaPeriod;
  disabled: boolean;
  atLimit: boolean;
};

export type UcatQuotaUsageResponse = {
  onlineTier: UcatOnlineTier;
  isQuotaExempt: boolean;
  unlimitedTrialEligible: boolean;
  onboardingCompleted: boolean;
  areas: UcatQuotaAreaUsage[];
};

export type QuotaExceededPayload = {
  code: "QUOTA_EXCEEDED";
  area: UcatQuotaArea;
  used: number;
  limit: number;
  period: UcatQuotaPeriod;
};

export const UCAT_QUOTA_AREA_LABELS: Record<UcatQuotaArea, string> = {
  practice: "Practice questions",
  sets: "Sets",
  mocks: "Mocks",
  learn: "Learning modules",
  skill_trainer: "Skill trainer attempts",
};
