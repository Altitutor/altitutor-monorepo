import {
  formatPayTierSessionType,
  formatPayTierStaffAttendanceType,
  sessionMetricKey,
  TEACHING_SESSION_TYPES,
  ADMIN_SESSION_TYPES,
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

export function buildMetricOverridesFromUi(sessionRows: SessionOverrideRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of sessionRows) {
    if (!row.sessionType.trim() || row.count === 0) continue;
    out[sessionOverrideRowToMetricKey(row)] = row.count;
  }
  return out;
}

export function formatSessionOverrideLabel(row: SessionOverrideRow): string {
  return `${formatPayTierSessionType(row.sessionType)} (${formatPayTierStaffAttendanceType(row.attendanceType || null)})`;
}

export function newSessionOverrideRow(): SessionOverrideRow {
  return {
    id: crypto.randomUUID(),
    sessionType: 'CLASS',
    attendanceType: 'MAIN_TUTOR',
    count: 0,
  };
}
