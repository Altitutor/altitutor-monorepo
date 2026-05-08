const MS_DAY = 86_400_000;

/**
 * Human-readable time since last check-in using whole days, weeks, months, or years.
 */
export function formatCheckInRecency(lastCheckInAtIso: string | null): string {
  if (!lastCheckInAtIso) return 'Never';
  const last = new Date(lastCheckInAtIso).getTime();
  if (Number.isNaN(last)) return '—';
  const now = Date.now();
  const diffMs = Math.max(0, now - last);
  const days = Math.floor(diffMs / MS_DAY);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'}`;
  const weeks = Math.floor(days / 7);
  if (days < 30) return `${weeks} week${weeks === 1 ? '' : 's'}`;
  const months = Math.floor(days / 30);
  if (days < 365) return `${months} month${months === 1 ? '' : 's'}`;
  const years = Math.floor(days / 365);
  return `${years} year${years === 1 ? '' : 's'}`;
}

/** Sort key: larger = more recent last check-in; null = never (sorts last in desc). */
export function lastCheckInSortKey(lastCheckInAtIso: string | null): number {
  if (!lastCheckInAtIso) return Number.NEGATIVE_INFINITY;
  const t = new Date(lastCheckInAtIso).getTime();
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
}

export type StalenessFilterId = '7d' | '30d' | '90d' | '365d';

export const STALENESS_FILTER_OPTIONS: { value: StalenessFilterId; label: string; minDays: number }[] = [
  { value: '7d', label: 'Last check-in over 1 week ago', minDays: 7 },
  { value: '30d', label: 'Last check-in over 1 month ago', minDays: 30 },
  { value: '90d', label: 'Last check-in over 3 months ago', minDays: 90 },
  { value: '365d', label: 'Last check-in over 1 year ago', minDays: 365 },
];

export function maxStalenessMinDays(selected: StalenessFilterId[]): number | null {
  if (!selected.length) return null;
  let max = 0;
  for (const id of selected) {
    const opt = STALENESS_FILTER_OPTIONS.find((o) => o.value === id);
    if (opt && opt.minDays > max) max = opt.minDays;
  }
  return max;
}

/**
 * Row matches staleness filter when last check-in is null or was at least `minDays` ago.
 */
export function matchesStalenessFilter(
  lastCheckInAtIso: string | null,
  minDays: number | null,
  nowMs: number = Date.now()
): boolean {
  if (minDays === null) return true;
  if (!lastCheckInAtIso) return true;
  const last = new Date(lastCheckInAtIso).getTime();
  if (Number.isNaN(last)) return true;
  const ageDays = (nowMs - last) / MS_DAY;
  return ageDays >= minDays;
}
