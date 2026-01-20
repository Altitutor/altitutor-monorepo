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
  students?: any[];
  staff?: any[];
};

/**
 * Generates a session title in the format:
 * {curriculum} {year_level} {subject_name} {class_level} {day_string} {start_time} - {end_time}
 * Example: "SACE Year 12 Mathematics Advanced Monday 14:00 - 16:00"
 */
export function getSessionTitle(session: FlattenedSessionDetail): string {
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

