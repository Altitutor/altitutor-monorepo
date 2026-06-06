/** Teaching session types counted toward teaching aggregates */
export const TEACHING_SESSION_TYPES = ['CLASS', 'DRAFTING', 'EXAM_COURSE'] as const;

/** Admin session types grouped for admin-shift metrics */
export const ADMIN_SESSION_TYPES = ['ADMIN_SHIFT', 'ADMIN_MEETING'] as const;

export const STAFF_ATTENDANCE_TYPES = ['MAIN_TUTOR', 'SECONDARY_TUTOR', 'TRIAL_TUTOR'] as const;

export type TeachingSessionType = (typeof TEACHING_SESSION_TYPES)[number];
export type AdminSessionType = (typeof ADMIN_SESSION_TYPES)[number];
export type StaffAttendanceType = (typeof STAFF_ATTENDANCE_TYPES)[number];

export function sessionMetricKey(sessionType: string, attendanceType?: string | null): string {
  const attendance = attendanceType?.trim() ? attendanceType : 'any';
  return `sessions.${sessionType}.${attendance}`;
}

export const METRIC_KEYS = {
  tenureDays: 'tenure.days',
  tenureWeeks: 'tenure.weeks',
  tenureMonths: 'tenure.months',
  timeSincePromotionDays: 'time_since_promotion.days',
  timeSincePromotionWeeks: 'time_since_promotion.weeks',
  timeSincePromotionMonths: 'time_since_promotion.months',
  teachingAll: 'sessions.teaching.all',
  adminAll: 'sessions.admin.all',
} as const;

export const TIME_METRIC_PREFIXES = ['tenure', 'time_since_promotion'] as const;
export type TimeMetricPrefix = (typeof TIME_METRIC_PREFIXES)[number];

export function resolveSessionCountMetricKey(params: {
  session_types: string[];
  attendance_types?: string[];
}): string {
  const types = params.session_types ?? [];
  const attendance = params.attendance_types ?? [];

  if (types.length === 0) {
    return METRIC_KEYS.teachingAll;
  }

  if (
    types.length === TEACHING_SESSION_TYPES.length &&
    TEACHING_SESSION_TYPES.every((t) => types.includes(t)) &&
    attendance.length === 0
  ) {
    return METRIC_KEYS.teachingAll;
  }

  if (
    types.length === ADMIN_SESSION_TYPES.length &&
    ADMIN_SESSION_TYPES.every((t) => types.includes(t)) &&
    attendance.length === 0
  ) {
    return METRIC_KEYS.adminAll;
  }

  if (types.length === 1 && attendance.length === 1) {
    return sessionMetricKey(types[0]!, attendance[0]!);
  }

  if (types.length === 1 && attendance.length === 0) {
    return sessionMetricKey(types[0]!, 'any');
  }

  return `sessions.custom.${types.sort().join('+')}.${attendance.length === 0 ? 'any' : attendance.sort().join('+')}`;
}

export function getMetricValue(metrics: Record<string, number>, key: string): number {
  const v = metrics[key];
  return typeof v === 'number' && !Number.isNaN(v) ? v : 0;
}
