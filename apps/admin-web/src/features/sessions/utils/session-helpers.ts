import type { Tables } from '@altitutor/shared';
import { formatSessionDate } from '@altitutor/shared';
import { formatTime } from '@/shared/utils/datetime';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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
 * Generates a session title in the format:
 * {curriculum} {year_level} {subject_name} {class_level} {day_string} {start_time} - {end_time}
 * Example: "SACE Year 12 Mathematics Advanced Monday 14:00 - 16:00"
 */
export function getSessionTitle(session: SessionWithDetails): string {
  const parts: string[] = [];
  
  const classData = session.class;
  const subject = classData?.subject;
  
  // Add curriculum
  if (subject?.curriculum) {
    parts.push(subject.curriculum);
  }
  
  // Add year level
  if (subject?.year_level != null) {
    parts.push(`Year ${subject.year_level}`);
  }
  
  // Add subject name
  if (subject?.name) {
    parts.push(subject.name);
  }
  
  // Add class level
  if (classData?.level) {
    parts.push(classData.level);
  }
  
  // Add day name
  if (classData?.day_of_week != null) {
    parts.push(DAY_NAMES[classData.day_of_week]);
  }
  
  // Add time range
  if (classData?.start_time && classData?.end_time) {
    parts.push(`${classData.start_time} - ${classData.end_time}`);
  }
  
  return parts.join(' ');
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
 * Returns a short display name for a session (e.g. for dialogs).
 * Prefers getSessionTitle, then date+time from start_at/end_at, then class time.
 */
export function getShortSessionName(session: SessionShortNameInput | null | undefined): string {
  if (!session) return 'this session';
  const fromTitle = getSessionTitle(session as SessionWithDetails);
  if (fromTitle) return fromTitle;

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

