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
