import { METRIC_KEYS } from './metric-keys';
import type { StaffPayTierRequirementKind, TimeRequirementParams, TimeUnit } from './types';

export const TIME_UNITS: TimeUnit[] = ['days', 'weeks', 'months'];

export function formatTimeUnit(unit: TimeUnit, count: number): string {
  const label = unit === 'days' ? 'day' : unit === 'weeks' ? 'week' : 'month';
  return count === 1 ? label : `${label}s`;
}

export function parseTimeRequirementParams(raw: unknown): TimeRequirementParams {
  const p = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const min = Number(p.min ?? 0);
  const unitRaw = p.unit;
  const unit =
    unitRaw === 'days' || unitRaw === 'weeks' || unitRaw === 'months' ? unitRaw : undefined;
  return {
    min: Number.isNaN(min) ? 0 : Math.max(0, Math.floor(min)),
    ...(unit ? { unit } : {}),
  };
}

export function resolveTimeUnit(
  kind: StaffPayTierRequirementKind,
  params: TimeRequirementParams
): TimeUnit {
  if (params.unit) return params.unit;
  if (kind === 'TENURE_MONTHS') return 'months';
  return 'days';
}

export function tenureMetricKeyForUnit(unit: TimeUnit): string {
  switch (unit) {
    case 'months':
      return METRIC_KEYS.tenureMonths;
    case 'weeks':
      return METRIC_KEYS.tenureWeeks;
    default:
      return METRIC_KEYS.tenureDays;
  }
}

export function timeSincePromotionMetricKeyForUnit(unit: TimeUnit): string {
  switch (unit) {
    case 'months':
      return METRIC_KEYS.timeSincePromotionMonths;
    case 'weeks':
      return METRIC_KEYS.timeSincePromotionWeeks;
    default:
      return METRIC_KEYS.timeSincePromotionDays;
  }
}

export function tenureKindForUnit(unit: TimeUnit): 'TENURE_DAYS' | 'TENURE_MONTHS' {
  return unit === 'months' ? 'TENURE_MONTHS' : 'TENURE_DAYS';
}

export function isTimeBasedRequirementKind(kind: StaffPayTierRequirementKind): boolean {
  return kind === 'TENURE_DAYS' || kind === 'TENURE_MONTHS' || kind === 'TIME_SINCE_LAST_PROMOTION';
}

export function isTenureRequirementKind(kind: StaffPayTierRequirementKind): boolean {
  return kind === 'TENURE_DAYS' || kind === 'TENURE_MONTHS';
}
