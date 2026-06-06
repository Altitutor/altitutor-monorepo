import type {
  PayTierTierStatus,
  RequirementParams,
  StaffPayTierRequirementKind,
  SessionCountRequirementParams,
  StaffTierPromotionOutcome,
  TimeRequirementParams,
} from './types';
import { formatTimeUnit, parseTimeRequirementParams, resolveTimeUnit } from './time-units';

/** Human-readable labels for session types used in pay tier metrics and overrides. */
export const PAY_TIER_SESSION_TYPE_LABELS: Record<string, string> = {
  CLASS: 'Class',
  DRAFTING: 'Drafting',
  EXAM_COURSE: 'Exam course',
  SUBSIDY_INTERVIEW: 'Subsidy interview',
  TRIAL_SESSION: 'Trial session',
  STAFF_INTERVIEW: 'Staff interview',
  ADMIN_SHIFT: 'Admin shift',
  ADMIN_MEETING: 'Admin meeting',
  CHECK_IN: 'Check-in',
  TRIAL_SHIFT: 'Trial shift',
};

/** Human-readable labels for staff attendance roles in session-count requirements. */
export const PAY_TIER_STAFF_ATTENDANCE_LABELS: Record<string, string> = {
  MAIN_TUTOR: 'Main tutor',
  SECONDARY_TUTOR: 'Secondary tutor',
  TRIAL_TUTOR: 'Trial tutor',
};

export function formatPayTierSessionType(type: string | null | undefined): string {
  if (!type) return 'Session';
  return (
    PAY_TIER_SESSION_TYPE_LABELS[type] ??
    type
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function formatPayTierStaffAttendanceType(type: string | null | undefined): string {
  if (!type) return 'Any role';
  return (
    PAY_TIER_STAFF_ATTENDANCE_LABELS[type] ??
    type
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function formatPayTierSessionTypesList(types: string[] | undefined): string {
  if (!types?.length) return 'teaching sessions';
  return types.map((t) => formatPayTierSessionType(t)).join(', ');
}

export function formatPayTierAttendanceTypesSuffix(
  types: string[] | undefined
): string {
  if (!types?.length) return '';
  return ` as ${types.map((t) => formatPayTierStaffAttendanceType(t)).join(', ')}`;
}

/** Labels for tier card status badges on the pay tier roadmap. */
export const PAY_TIER_TIER_STATUS_LABELS: Record<PayTierTierStatus, string> = {
  completed: 'Completed',
  current: 'Current tier',
  locked: 'Not yet unlocked',
};

export function formatPayTierTierStatus(status: PayTierTierStatus): string {
  return PAY_TIER_TIER_STATUS_LABELS[status];
}

function formatTimeRequirementLabel(
  prefix: string,
  kind: StaffPayTierRequirementKind,
  params: TimeRequirementParams
): string {
  const parsed = parseTimeRequirementParams(params);
  const unit = resolveTimeUnit(kind, parsed);
  return `${parsed.min} ${formatTimeUnit(unit, parsed.min)} ${prefix}`;
}

export function formatPayTierRequirementLabel(
  kind: StaffPayTierRequirementKind,
  params: RequirementParams
): string {
  if (kind === 'TENURE_DAYS' || kind === 'TENURE_MONTHS') {
    return formatTimeRequirementLabel('employed', kind, params as TimeRequirementParams);
  }
  if (kind === 'TIME_SINCE_LAST_PROMOTION') {
    return formatTimeRequirementLabel('since last promotion', kind, params as TimeRequirementParams);
  }
  const p = params as SessionCountRequirementParams;
  const types = formatPayTierSessionTypesList(p.session_types);
  const roles = formatPayTierAttendanceTypesSuffix(p.attendance_types);
  return `${p.min} ${types}${roles}`;
}

export function formatPayTierPromotionOutcome(outcome: StaffTierPromotionOutcome | string): string {
  switch (outcome) {
    case 'approved':
      return 'Promoted';
    case 'deferred':
      return 'Deferred';
    case 'not_ready':
      return 'Not ready';
    default:
      return typeof outcome === 'string'
        ? outcome.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Unknown';
  }
}

export function formatTimeMetricOverrideLabel(prefix: 'tenure' | 'time_since_promotion', unit: string): string {
  if (prefix === 'tenure') {
    return `Tenure (${unit})`;
  }
  return `Time since last promotion (${unit})`;
}
