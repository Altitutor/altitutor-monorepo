export type StaffPayTierRequirementKind = 'TENURE_DAYS' | 'TENURE_MONTHS' | 'SESSION_COUNT';

export type StaffTierPromotionOutcome = 'approved' | 'deferred' | 'not_ready';

export interface StaffPayTier {
  tier_number: number;
  name: string | null;
  base_pay_rate_cents: number;
  currency: string;
}

export interface TenureRequirementParams {
  min: number;
}

export interface SessionCountRequirementParams {
  min: number;
  session_types: string[];
  attendance_types?: string[];
}

export type RequirementParams = TenureRequirementParams | SessionCountRequirementParams;

export interface StaffPayTierRequirement {
  id: string;
  tier_number: number;
  requirement_kind: StaffPayTierRequirementKind;
  params: RequirementParams;
  sort_order: number;
}

export interface RequirementProgress {
  id: string;
  requirement_kind: StaffPayTierRequirementKind;
  params: RequirementParams;
  label: string;
  required: number;
  current: number;
  met: boolean;
}

export interface StaffTierPromotionRecord {
  id: string;
  staff_id: string;
  from_tier_number: number;
  to_tier_number: number;
  check_in_session_id: string | null;
  outcome: StaffTierPromotionOutcome;
  notes: string | null;
  reviewed_at: string;
}

export interface LastCheckInInfo {
  sessionId: string;
  startAt: string;
  longName: string | null;
}

export interface StaffTierProgress {
  staffId: string;
  currentTierNumber: number;
  nextTierNumber: number | null;
  employmentStartedAt: string;
  metricOverrides: Record<string, number>;
  metrics: Record<string, number>;
  tiers: StaffPayTier[];
  requirementsForNextTier: RequirementProgress[];
  isEligibleForReview: boolean;
  promotions: StaffTierPromotionRecord[];
  lastCheckIn: LastCheckInInfo | null;
}
