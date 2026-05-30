import { evaluateRequirements, isEligibleForReview } from './evaluate';
import { parseRequirementParams } from './evaluate';
import type {
  LastCheckInInfo,
  StaffPayTier,
  StaffPayTierRequirement,
  StaffTierProgress,
  StaffTierPromotionRecord,
} from './types';

export interface BuildStaffTierProgressInput {
  staffId: string;
  currentTierNumber: number;
  employmentStartedAt: string;
  metricOverrides: Record<string, number>;
  metrics: Record<string, number>;
  tiers: StaffPayTier[];
  requirements: Array<{
    id: string;
    tier_number: number;
    requirement_kind: StaffPayTierRequirement['requirement_kind'];
    params: unknown;
    sort_order: number;
  }>;
  promotions: StaffTierPromotionRecord[];
  lastCheckIn: LastCheckInInfo | null;
}

export function buildStaffTierProgress(input: BuildStaffTierProgressInput): StaffTierProgress {
  const sortedTiers = input.tiers.slice().sort((a, b) => a.tier_number - b.tier_number);
  const maxTier = sortedTiers.length > 0 ? sortedTiers[sortedTiers.length - 1]!.tier_number : input.currentTierNumber;
  const nextTierNumber =
    input.currentTierNumber < maxTier ? input.currentTierNumber + 1 : null;

  const reqsForCurrent = input.requirements
    .filter((r) => r.tier_number === input.currentTierNumber)
    .map(
      (r): StaffPayTierRequirement => ({
        id: r.id,
        tier_number: r.tier_number,
        requirement_kind: r.requirement_kind,
        params: parseRequirementParams(r.requirement_kind, r.params),
        sort_order: r.sort_order,
      })
    );

  const requirementProgress = evaluateRequirements(reqsForCurrent, input.metrics);

  return {
    staffId: input.staffId,
    currentTierNumber: input.currentTierNumber,
    nextTierNumber,
    employmentStartedAt: input.employmentStartedAt,
    metricOverrides: input.metricOverrides,
    metrics: input.metrics,
    tiers: sortedTiers,
    requirementsForNextTier: requirementProgress,
    isEligibleForReview: nextTierNumber !== null && isEligibleForReview(requirementProgress),
    promotions: input.promotions,
    lastCheckIn: input.lastCheckIn,
  };
}
