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
