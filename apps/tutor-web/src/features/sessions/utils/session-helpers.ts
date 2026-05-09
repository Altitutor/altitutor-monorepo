import type { Tables } from '@altitutor/shared';
import { formatSessionDate } from '@altitutor/shared';

export { formatSessionDate };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Session with full class and subject details (nested structure)
 */
export type SessionWithDetails = Tables<'sessions'> & {
  class?: Tables<'classes'> & {
    subject?: Tables<'subjects'>;
  };
};

/**
 * Flattened session data from vtutor_session_detail view
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
  students?: SessionStudent[];
  staff?: SessionStaff[];
};

/**
 * Student data from vtutor_session_detail view
 */
export interface SessionStudent {
  id: string;
  first_name: string;
  last_name: string;
  year_level: number | null;
  session_student_id?: string;
  planned_absence?: boolean;
  is_rescheduled?: boolean;
  is_credited?: boolean;
}

/**
 * Staff data from vtutor_session_detail view
 */
export interface SessionStaff {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  type?: string;
  subjects?: Array<{ id: string; name: string }>;
}

/**
 * Generates a session title.
 * Prefers session long_name when present (e.g. from view); otherwise builds from parts.
 */
export function getSessionTitle(session: SessionWithDetails | FlattenedSessionDetail): string {
  const withLongName = session as { long_name?: string | null };
  if (withLongName.long_name?.trim()) return withLongName.long_name.trim();

  const parts: string[] = [];
  // Check if this is flattened data (from vtutor_session_detail)
  const isFlattened = 'subject_curriculum' in session || 'day_of_week' in session;

  if (isFlattened) {
    const flatSession = session as FlattenedSessionDetail;

    // Add curriculum
    if (flatSession.subject_curriculum) {
      parts.push(flatSession.subject_curriculum);
    }
    
    // Add year level
    if (flatSession.subject_year_level != null) {
      parts.push(`Year ${flatSession.subject_year_level}`);
    }
    
    // Add subject name
    if (flatSession.subject_name) {
      parts.push(flatSession.subject_name);
    }
    
    // Add class level
    if (flatSession.class_level) {
      parts.push(flatSession.class_level);
    }
    
    // Add day name
    if (flatSession.day_of_week != null) {
      parts.push(DAY_NAMES[flatSession.day_of_week]);
    }
    
    // Add time range
    if (flatSession.start_time && flatSession.end_time) {
      parts.push(`${flatSession.start_time} - ${flatSession.end_time}`);
    }
  } else {
    // Nested structure (original format)
    const nestedSession = session as SessionWithDetails;
    const classData = nestedSession.class;
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
  }
  
  return parts.join(' ');
}

