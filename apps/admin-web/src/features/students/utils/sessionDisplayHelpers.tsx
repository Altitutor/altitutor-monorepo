import type { Tables } from '@altitutor/shared';

/**
 * Get today's date in local timezone (YYYY-MM-DD format)
 */
export function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date string for display
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
}

/**
 * Short display name for a session/class from database only.
 * Uses session.short_name, then class.short_name; no building from subject parts.
 */
export function getClassShortDisplay(
  session: Tables<'sessions'>,
  classesById: Record<string, Tables<'classes'>>,
  _subjectsById: Record<string, Tables<'subjects'>>
): string {
  if (session.short_name?.trim()) return session.short_name.trim();
  const cls = session.class_id ? classesById[session.class_id] : undefined;
  return cls?.short_name?.trim() ?? '';
}

/**
 * Full display name for a session/class from database only.
 * Uses session.long_name, then class.long_name; no building from subject parts.
 */
export function getClassDisplay(
  session: Tables<'sessions'>,
  classesById: Record<string, Tables<'classes'>>,
  _subjectsById: Record<string, Tables<'subjects'>>
): string {
  if (session.long_name?.trim()) return session.long_name.trim();
  const cls = session.class_id ? classesById[session.class_id] : undefined;
  return cls?.long_name?.trim() ?? '';
}

/**
 * Get time range display for a session
 */
export function getTimeRange(session: Tables<'sessions'>): string {
  const s = session.start_at ? new Date(session.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const e = session.end_at ? new Date(session.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  return s && e ? `${s}–${e}` : s || e || '-';
}

