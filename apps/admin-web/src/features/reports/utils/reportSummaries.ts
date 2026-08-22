import type { ReportDataPoint, ReportEntityMeta } from '../types';

export type ReportTotalMode = 'sum' | 'latest';
export type ReportStaffMetaKey = keyof ReportEntityMeta;

export interface ReportSummary {
  total: number;
  byStaff: Array<{ label: string; value: number }>;
}

function entitiesForSummary(
  data: ReportDataPoint[],
  totalMode: ReportTotalMode
): ReportDataPoint['entities'] {
  const source = totalMode === 'latest' ? data.at(-1)?.entities ?? [] : data.flatMap((d) => d.entities);
  const seen = new Set<string>();
  return source.filter((entity) => {
    const summaryKey = entity.meta?.summaryKey ?? entity.id;
    if (seen.has(summaryKey)) return false;
    seen.add(summaryKey);
    return true;
  });
}

export function buildReportSummary(
  data: ReportDataPoint[],
  totalMode: ReportTotalMode,
  staffMetaKeys: ReportStaffMetaKey[] = []
): ReportSummary {
  const total =
    totalMode === 'latest'
      ? data.at(-1)?.count ?? 0
      : data.reduce((sum, point) => sum + point.count, 0);
  const counts = new Map<string, number>();

  for (const entity of entitiesForSummary(data, totalMode)) {
    const staffName = staffMetaKeys
      .map((key) => entity.meta?.[key])
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (!staffName) continue;
    counts.set(staffName, (counts.get(staffName) ?? 0) + 1);
  }

  return {
    total,
    byStaff: [...counts.entries()]
      .filter(([, value]) => value > 0)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
  };
}
