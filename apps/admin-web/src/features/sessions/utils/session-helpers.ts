import type { Tables } from '@altitutor/shared';
import { formatSessionDate } from '@altitutor/shared';
import { formatSessionType } from '@/shared/utils';
import { formatTime } from '@/shared/utils/datetime';

export { formatSessionDate };

/**
 * Session with full class and subject details.
 * class and class.subject may be null from API/DB joins.
 */
export type SessionWithDetails = Tables<'sessions'> & {
  class?: (Tables<'classes'> & {
    subject?: Tables<'subjects'> | null;
  }) | null;
};

/**
 * Session title from database only.
 * Uses session.long_name; no frontend building from class/subject parts.
 */
export function getSessionTitle(session: SessionWithDetails): string {
  return session.long_name?.trim() ?? '';
}

/**
 * Minimal session-like shape for short name fallbacks
 */
export type SessionShortNameInput = {
  start_at?: string | null;
  end_at?: string | null;
  class?: { start_time?: string | null; end_time?: string | null } | null;
} & Partial<SessionWithDetails>;

/**
 * Short display name for a session (e.g. for dialogs).
 * Uses session.short_name, then session.long_name from DB; then date+time or "this session".
 */
export function getShortSessionName(session: SessionShortNameInput | null | undefined): string {
  if (!session) return 'this session';
  const s = session as SessionShortNameInput & { short_name?: string | null; long_name?: string | null };
  if (s.short_name?.trim()) return s.short_name.trim();
  if (s.long_name?.trim()) return s.long_name.trim();

  if (session.start_at && session.end_at) {
    const start = new Date(session.start_at);
    const end = new Date(session.end_at);
    const startHHMM = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`;
    const endHHMM = `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`;
    return `${start.toLocaleDateString('en-US')} ${formatTime(startHHMM)} - ${formatTime(endHHMM)}`;
  }

  if (session.class?.start_time && session.class?.end_time) {
    return `${formatTime(session.class.start_time)} - ${formatTime(session.class.end_time)}`;
  }

  return 'this session';
}

const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function getValidDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Compact session navigation date, e.g. "4 Aug". */
export function formatSessionNavigationDate(value: Date | string | null | undefined): string {
  const date = getValidDate(value);
  return date ? `${date.getDate()} ${SHORT_MONTH_NAMES[date.getMonth()]}` : '';
}

/** Full session information date, e.g. "Wednesday 9 Sep 2026". */
export function formatSessionLongDate(value: Date | string | null | undefined): string {
  const date = getValidDate(value);
  if (!date) return '';
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  return `${weekday} ${date.getDate()} ${SHORT_MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/** Searchable session selector label containing both date and time. */
export function getSessionNavigationLabel(session: SessionShortNameInput): string {
  const date = getValidDate(session.start_at);
  const dateLabel = formatSessionNavigationDate(date);
  if (!date) return getShortSessionName(session);

  const startTime = formatTime(
    `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  );
  const end = getValidDate(session.end_at);
  const endTime = end
    ? formatTime(
        `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`
      )
    : '';

  return [dateLabel, [startTime, endTime].filter(Boolean).join(' - ')].filter(Boolean).join(' · ');
}

export function getAdjacentSessionSiblings<T extends { id: string }>(
  sessions: T[],
  currentSessionId: string | null
): { previous: T | null; next: T | null } {
  if (sessions.length < 2 || !currentSessionId) {
    return { previous: null, next: null };
  }

  const currentIndex = sessions.findIndex((session) => session.id === currentSessionId);
  if (currentIndex < 0) {
    return { previous: null, next: null };
  }

  return {
    previous: sessions[currentIndex - 1] ?? null,
    next: sessions[currentIndex + 1] ?? null,
  };
}

/**
 * Label for session cards/calendar cells.
 * Prefers stored session names, then class names, then subject names.
 */
export type SessionCardDisplayInput = {
  type?: Tables<'sessions'>['type'] | string | null;
  short_name?: string | null;
  long_name?: string | null;
  class?: {
    short_name?: string | null;
    long_name?: string | null;
  } | null;
  subject?: {
    short_name?: string | null;
    long_name?: string | null;
    name?: string | null;
  } | null;
};

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

export function getSessionCardDisplayName(
  session: SessionCardDisplayInput,
  compact: boolean
): string {
  if (compact) {
    return (
      firstNonEmpty(
        session.short_name,
        session.class?.short_name,
        session.subject?.short_name,
        session.subject?.long_name,
        session.subject?.name
      ) || formatSessionType(session.type)
    );
  }

  return (
    firstNonEmpty(
      session.long_name,
      session.class?.long_name,
      session.subject?.long_name,
      session.subject?.name
    ) || formatSessionType(session.type)
  );
}
