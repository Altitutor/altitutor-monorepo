import type { Tables } from '@altitutor/shared';

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
  // Related data
  students?: any[];
  staff?: any[];
};

/**
 * Generates a session title in the format:
 * {curriculum} {year_level} {subject_name} {class_level} {day_string} {start_time} - {end_time}
 * Example: "SACE Year 12 Mathematics Advanced Monday 14:00 - 16:00"
 */
export function getSessionTitle(session: SessionWithDetails | FlattenedSessionDetail): string {
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

/**
 * Formats a date in the format "Friday 24/10/2025"
 */
export function formatSessionDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dayName = DAY_NAMES[d.getDay()];
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  
  return `${dayName} ${day}/${month}/${year}`;
}


