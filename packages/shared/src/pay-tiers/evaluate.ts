import { formatPayTierRequirementLabel } from './labels';
import {
  getMetricValue,
  METRIC_KEYS,
  resolveSessionCountMetricKey,
  sessionMetricKey,
} from './metric-keys';
import type {
  RequirementParams,
  RequirementProgress,
  SessionCountRequirementParams,
  StaffPayTierRequirement,
  StaffPayTierRequirementKind,
  TenureRequirementParams,
} from './types';

function tenureMetricKey(kind: StaffPayTierRequirementKind): string {
  return kind === 'TENURE_MONTHS' ? METRIC_KEYS.tenureMonths : METRIC_KEYS.tenureDays;
}

export function evaluateRequirement(
  requirement: Pick<StaffPayTierRequirement, 'id' | 'requirement_kind' | 'params'>,
  metrics: Record<string, number>
): RequirementProgress {
  const params = requirement.params;
  let required = 0;
  let current = 0;
  let metricKey = '';

  if (requirement.requirement_kind === 'TENURE_DAYS' || requirement.requirement_kind === 'TENURE_MONTHS') {
    const p = params as TenureRequirementParams;
    required = p.min ?? 0;
    metricKey = tenureMetricKey(requirement.requirement_kind);
    current = getMetricValue(metrics, metricKey);
  } else {
    const p = params as SessionCountRequirementParams;
    required = p.min ?? 0;
    metricKey = resolveSessionCountMetricKey({
      session_types: p.session_types ?? [],
      attendance_types: p.attendance_types,
    });
    current = getMetricValue(metrics, metricKey);

    if (metricKey.startsWith('sessions.custom.') && p.session_types?.length) {
      current = sumSessionCountMetrics(metrics, p);
    }
  }

  return {
    id: requirement.id,
    requirement_kind: requirement.requirement_kind,
    params,
    label: formatPayTierRequirementLabel(requirement.requirement_kind, params),
    required,
    current,
    met: current >= required,
  };
}

function sumSessionCountMetrics(
  metrics: Record<string, number>,
  params: SessionCountRequirementParams
): number {
  const types = params.session_types ?? [];
  const attendance = params.attendance_types ?? [];

  if (attendance.length === 0) {
    return types.reduce((sum, t) => sum + getMetricValue(metrics, sessionMetricKey(t, 'any')), 0);
  }

  return types.reduce(
    (sum, t) =>
      sum +
      attendance.reduce((inner, a) => inner + getMetricValue(metrics, sessionMetricKey(t, a)), 0),
    0
  );
}

export function evaluateRequirements(
  requirements: StaffPayTierRequirement[],
  metrics: Record<string, number>
): RequirementProgress[] {
  return requirements
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((r) => evaluateRequirement(r, metrics));
}

export function isEligibleForReview(requirementProgress: RequirementProgress[]): boolean {
  if (requirementProgress.length === 0) return false;
  return requirementProgress.every((r) => r.met);
}

/**
 * Highest tier number the staff member may be promoted to in one approval,
 * based on meeting requirements for each intermediate tier (current → target).
 */
export function getHighestEligiblePromotionTier(
  currentTierNumber: number,
  maxTierNumber: number,
  requirements: StaffPayTierRequirement[],
  metrics: Record<string, number>
): number {
  let tier = currentTierNumber;
  while (tier < maxTierNumber) {
    const reqsForTier = requirements.filter((r) => r.tier_number === tier);
    const progress = evaluateRequirements(reqsForTier, metrics);
    if (!isEligibleForReview(progress)) break;
    tier += 1;
  }
  return tier;
}

export function getPromotionTierOptions(
  fromTierNumber: number,
  highestEligibleTier: number
): number[] {
  if (highestEligibleTier <= fromTierNumber) return [];
  const options: number[] = [];
  for (let t = fromTierNumber + 1; t <= highestEligibleTier; t += 1) {
    options.push(t);
  }
  return options;
}

export function validateApprovedPromotionTier(
  fromTierNumber: number,
  toTierNumber: number,
  highestEligibleTier: number
): string | null {
  if (toTierNumber <= fromTierNumber) {
    return 'Promotion target must be higher than the current tier';
  }
  if (toTierNumber > highestEligibleTier) {
    return 'Promotion target exceeds the highest tier this staff member is eligible for';
  }
  return null;
}

export function parseRequirementParams(
  kind: StaffPayTierRequirementKind,
  raw: unknown
): RequirementParams {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  if (kind === 'TENURE_DAYS' || kind === 'TENURE_MONTHS') {
    return { min: Number(p.min ?? 0) };
  }
  return {
    min: Number(p.min ?? 0),
    session_types: Array.isArray(p.session_types)
      ? p.session_types.filter((x): x is string => typeof x === 'string')
      : [],
    attendance_types: Array.isArray(p.attendance_types)
      ? p.attendance_types.filter((x): x is string => typeof x === 'string')
      : undefined,
  };
}

export function formatPayRate(cents: number, currency: string): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}
