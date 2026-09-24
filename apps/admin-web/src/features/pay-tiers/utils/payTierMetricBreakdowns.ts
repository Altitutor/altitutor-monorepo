import {
  getMetricValue,
  parseResourceMetricKey,
  PAY_TIER_RESOURCE_OVERRIDE_TYPES,
  PAY_TIER_SESSION_TYPES,
  STAFF_ATTENDANCE_TYPES,
  formatPayTierResourceType,
  formatPayTierSessionType,
  formatPayTierStaffAttendanceType,
  sessionMetricKey,
} from '@altitutor/shared/pay-tiers';

export type MetricBreakdownItem = {
  key: string;
  label: string;
  value: number;
};

export type SessionMetricBreakdownItem = MetricBreakdownItem & {
  attendance: MetricBreakdownItem[];
};

export type MetricBreakdown<TItem extends MetricBreakdownItem = MetricBreakdownItem> = {
  total: number;
  items: TItem[];
};

export function getSessionMetricBreakdown(
  metrics: Record<string, number>
): MetricBreakdown<SessionMetricBreakdownItem> {
  const items = PAY_TIER_SESSION_TYPES.flatMap((sessionType) => {
    const attendance = STAFF_ATTENDANCE_TYPES.map((attendanceType) => ({
      key: attendanceType,
      label: formatPayTierStaffAttendanceType(attendanceType),
      value: getMetricValue(metrics, sessionMetricKey(sessionType, attendanceType)),
    })).filter((item) => item.value !== 0);

    const aggregateKey = sessionMetricKey(sessionType, 'any');
    const aggregateValue = getMetricValue(metrics, aggregateKey);
    const value =
      aggregateKey in metrics
        ? aggregateValue
        : attendance.reduce((sum, item) => sum + item.value, 0);

    if (value === 0 && attendance.length === 0) return [];

    return [
      {
        key: sessionType,
        label: formatPayTierSessionType(sessionType),
        value,
        attendance,
      },
    ];
  });

  return {
    total: items.reduce((sum, item) => sum + item.value, 0),
    items,
  };
}

export function getResourceMetricBreakdown(
  metrics: Record<string, number>
): MetricBreakdown {
  const totalsByType = new Map<string, number>();

  for (const [key, value] of Object.entries(metrics)) {
    const parsed = parseResourceMetricKey(key);
    if (!parsed || value === 0) continue;
    totalsByType.set(parsed.resourceType, (totalsByType.get(parsed.resourceType) ?? 0) + value);
  }

  const knownTypeOrder = new Map<string, number>(
    PAY_TIER_RESOURCE_OVERRIDE_TYPES.map((resourceType, index) => [resourceType, index])
  );
  const items = Array.from(totalsByType, ([resourceType, value]) => ({
    key: resourceType,
    label: formatPayTierResourceType(resourceType),
    value,
  })).sort((a, b) => {
    const aOrder = knownTypeOrder.get(a.key) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = knownTypeOrder.get(b.key) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.label.localeCompare(b.label);
  });

  return {
    total: items.reduce((sum, item) => sum + item.value, 0),
    items,
  };
}
