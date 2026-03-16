import { formatSessionDate } from '@altitutor/shared';

export { formatSessionDate };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Flattened session data from vstudent_session_detail view
 */
export type FlattenedSessionDetail = {
  session_id: string;
  session_type: string;
  class_id: string | null;
  subject_id: string | null;
  start_at: string | null;
  end_at: string | null;
  // Class fields (flattened)
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  class_level: string | null;
  class_status: string | null;
  // Subject fields (flattened)
  subject_name: string | null;
  subject_curriculum: string | null;
  subject_discipline: string | null;
  subject_level: string | null;
  subject_color: string | null;
  subject_year_level: number | null;
  subject_short_name: string | null;
  subject_long_name: string | null;
  // Related data
  students?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    year_level?: number;
  }>;
  staff?: Array<{
    id: string;
    first_name: string;
    last_name: string;
    role?: string;
    type?: string;
  }>;
};

/**
 * Generates a session title.
 * Prefers session long_name when present (e.g. from view); otherwise builds from parts.
 */
export function getSessionTitle(session: FlattenedSessionDetail): string {
  const withLongName = session as { long_name?: string | null };
  if (withLongName.long_name?.trim()) return withLongName.long_name.trim();

  const parts: string[] = [];
  // Add curriculum
  if (session.subject_curriculum) {
    parts.push(session.subject_curriculum);
  }
  
  // Add year level
  if (session.subject_year_level != null) {
    parts.push(`Year ${session.subject_year_level}`);
  }
  
  // Add subject name
  if (session.subject_name) {
    parts.push(session.subject_name);
  }
  
  // Add class level
  if (session.class_level) {
    parts.push(session.class_level);
  }
  
  // Add day name
  if (session.day_of_week != null) {
    parts.push(DAY_NAMES[session.day_of_week]);
  }
  
  // Add time range
  if (session.start_time && session.end_time) {
    parts.push(`${session.start_time} - ${session.end_time}`);
  }
  
  return parts.join(' ');
}
