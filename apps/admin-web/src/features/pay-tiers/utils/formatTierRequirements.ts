import {
  formatPayTierRequirementLabel,
  parseRequirementParams,
  type StaffPayTierRequirementKind,
} from '@altitutor/shared/pay-tiers';

export type TierRequirementLike = {
  id: string;
  requirement_kind: StaffPayTierRequirementKind;
  params: Record<string, unknown>;
};

export function formatTierRequirementLabel(requirement: TierRequirementLike): string {
  return formatPayTierRequirementLabel(
    requirement.requirement_kind,
    parseRequirementParams(requirement.requirement_kind, requirement.params)
  );
}

export function formatTierRequirementLabels(requirements: TierRequirementLike[]): string[] {
  return requirements.map(formatTierRequirementLabel);
}
