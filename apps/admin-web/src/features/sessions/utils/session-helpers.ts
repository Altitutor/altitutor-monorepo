import type { Tables } from '@altitutor/shared';
import { formatSessionDate } from '@altitutor/shared';
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

