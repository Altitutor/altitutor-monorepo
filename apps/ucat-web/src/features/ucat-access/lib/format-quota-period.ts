import type { UcatQuotaPeriod } from "@/features/ucat-access/types/quota";

const PERIOD_LABELS: Record<UcatQuotaPeriod, string> = {
  day: "today",
  week: "this week",
  month: "this month",
};

export function formatQuotaPeriodLabel(period: UcatQuotaPeriod): string {
  return PERIOD_LABELS[period];
}

export function formatQuotaUsageLabel(
  used: number,
  limit: number,
  period: UcatQuotaPeriod,
): string {
  return `${used} of ${limit} used ${formatQuotaPeriodLabel(period)}`;
}
