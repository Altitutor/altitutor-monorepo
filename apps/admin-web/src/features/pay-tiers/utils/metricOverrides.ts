import {
  formatPayTierSessionType,
  formatPayTierStaffAttendanceType,
  formatTimeMetricOverrideLabel,
  METRIC_KEYS,
  sessionMetricKey,
  TIME_UNITS,
  TEACHING_SESSION_TYPES,
  ADMIN_SESSION_TYPES,
  type TimeUnit,
} from '@altitutor/shared/pay-tiers';

export const OVERRIDE_SESSION_TYPES = [
  ...TEACHING_SESSION_TYPES,
  ...ADMIN_SESSION_TYPES,
] as const;

export type SessionOverrideRow = {
  id: string;
  sessionType: string;
  attendanceType: string;
  count: number;
};

export type TimeOverrideRow = {
  id: string;
  metricKey: string;
  count: number;
};

const TIME_OVERRIDE_OPTIONS = [
  { metricKey: METRIC_KEYS.tenureDays, prefix: 'tenure' as const, unit: 'days' as TimeUnit },
  { metricKey: METRIC_KEYS.tenureWeeks, prefix: 'tenure' as const, unit: 'weeks' as TimeUnit },
  { metricKey: METRIC_KEYS.tenureMonths, prefix: 'tenure' as const, unit: 'months' as TimeUnit },
  {
    metricKey: METRIC_KEYS.timeSincePromotionDays,
    prefix: 'time_since_promotion' as const,
    unit: 'days' as TimeUnit,
  },
  {
    metricKey: METRIC_KEYS.timeSincePromotionWeeks,
    prefix: 'time_since_promotion' as const,
    unit: 'weeks' as TimeUnit,
  },
  {
    metricKey: METRIC_KEYS.timeSincePromotionMonths,
    prefix: 'time_since_promotion' as const,
    unit: 'months' as TimeUnit,
  },
] as const;

export function sessionOverridesToRows(overrides: Record<string, number>): SessionOverrideRow[] {
  const rows: SessionOverrideRow[] = [];
  for (const [key, count] of Object.entries(overrides)) {
    if (!key.startsWith('sessions.')) continue;
    const parsed = parseSessionMetricKey(key);
    if (!parsed) continue;
    rows.push({
      id: key,
      sessionType: parsed.sessionType,
      attendanceType: parsed.attendanceType,
      count,
    });
  }
  return rows.sort((a, b) => a.sessionType.localeCompare(b.sessionType));
}

export function timeOverridesToRows(overrides: Record<string, number>): TimeOverrideRow[] {
  const rows: TimeOverrideRow[] = [];
  for (const option of TIME_OVERRIDE_OPTIONS) {
    const count = overrides[option.metricKey];
    if (typeof count === 'number' && count !== 0) {
      rows.push({ id: option.metricKey, metricKey: option.metricKey, count });
    }
  }
  return rows;
}

export function parseSessionMetricKey(key: string): { sessionType: string; attendanceType: string } | null {
  const parts = key.split('.');
  if (parts[0] !== 'sessions' || parts.length < 3) return null;
  if (parts[1] === 'teaching' || parts[1] === 'admin' || parts[1] === 'custom') return null;
  const sessionType = parts[1]!;
  const attendanceType = parts[2] === 'any' ? '' : (parts[2] ?? '');
  return { sessionType, attendanceType };
}

export function sessionOverrideRowToMetricKey(row: SessionOverrideRow): string {
  return sessionMetricKey(row.sessionType, row.attendanceType || null);
}

export function buildMetricOverridesFromUi(
  sessionRows: SessionOverrideRow[],
  timeRows: TimeOverrideRow[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of sessionRows) {
    if (!row.sessionType.trim() || row.count === 0) continue;
    out[sessionOverrideRowToMetricKey(row)] = row.count;
  }
  for (const row of timeRows) {
    if (!row.metricKey.trim() || row.count === 0) continue;
    out[row.metricKey] = row.count;
  }
  return out;
}

export function formatSessionOverrideLabel(row: SessionOverrideRow): string {
  return `${formatPayTierSessionType(row.sessionType)} (${formatPayTierStaffAttendanceType(row.attendanceType || null)})`;
}

export function formatTimeOverrideLabel(metricKey: string): string {
  const option = TIME_OVERRIDE_OPTIONS.find((o) => o.metricKey === metricKey);
  if (!option) return metricKey;
  return formatTimeMetricOverrideLabel(option.prefix, option.unit);
}

export function newSessionOverrideRow(): SessionOverrideRow {
  return {
    id: crypto.randomUUID(),
    sessionType: 'CLASS',
    attendanceType: 'MAIN_TUTOR',
    count: 0,
  };
}

export function newTimeOverrideRow(): TimeOverrideRow {
  return {
    id: crypto.randomUUID(),
    metricKey: METRIC_KEYS.timeSincePromotionDays,
    count: 0,
  };
}

export function getTimeOverrideOptions() {
  return TIME_OVERRIDE_OPTIONS.map((option) => ({
    metricKey: option.metricKey,
    label: formatTimeMetricOverrideLabel(option.prefix, option.unit),
  }));
}

export { TIME_UNITS };
