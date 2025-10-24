import type { Tables } from '@altitutor/shared';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Session with full class and subject details
 */
export type SessionWithDetails = Tables<'sessions'> & {
  class?: Tables<'classes'> & {
    subject?: Tables<'subjects'>;
  };
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

