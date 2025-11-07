import type { Tables } from '@altitutor/shared';

/**
 * Calculate the first session date for a class on or after the enrollment date
 * @param classData - The class with day_of_week and start_time
 * @param enrollmentDate - The enrollment date (at midnight Adelaide time)
 * @returns Date object of the first session on/after enrollmentDate
 */
export function calculateFirstSessionDate(
  classData: Pick<Tables<'classes'>, 'day_of_week' | 'start_time'>,
  enrollmentDate: Date
): Date {
  const enrollDay = enrollmentDate.getDay();
  const classDayOfWeek = classData.day_of_week;
  
  // Calculate days until next occurrence of class day
  let daysUntilClass = classDayOfWeek - enrollDay;
  if (daysUntilClass < 0) {
    daysUntilClass += 7;
  }
  
  // Create date for the first session
  const firstSessionDate = new Date(enrollmentDate);
  firstSessionDate.setDate(firstSessionDate.getDate() + daysUntilClass);
  
  // Parse and set the time from start_time (format: "HH:MM")
  const [hours, minutes] = classData.start_time.split(':').map(Number);
  firstSessionDate.setHours(hours, minutes, 0, 0);
  
  return firstSessionDate;
}

/**
 * Calculate the last session date for a class before the unenrollment date
 * @param classData - The class with day_of_week and start_time
 * @param unenrollmentDate - The unenrollment date (at midnight Adelaide time)
 * @returns Date object of the last session before unenrollmentDate, or null if no session exists
 */
export function calculateLastSessionDate(
  classData: Pick<Tables<'classes'>, 'day_of_week' | 'start_time'>,
  unenrollmentDate: Date
): Date | null {
  const unenrollDay = unenrollmentDate.getDay();
  const classDayOfWeek = classData.day_of_week;
  
  // Calculate days back to last occurrence of class day before unenrollment
  let daysBackToClass = unenrollDay - classDayOfWeek;
  if (daysBackToClass <= 0) {
    daysBackToClass += 7;
  }
  
  // Create date for the last session
  const lastSessionDate = new Date(unenrollmentDate);
  lastSessionDate.setDate(lastSessionDate.getDate() - daysBackToClass);
  
  // If the calculated date is in the future, return null
  if (lastSessionDate >= unenrollmentDate) {
    return null;
  }
  
  // Parse and set the time from start_time (format: "HH:MM")
  const [hours, minutes] = classData.start_time.split(':').map(Number);
  lastSessionDate.setHours(hours, minutes, 0, 0);
  
  return lastSessionDate;
}

/**
 * Format date and time for display
 * @param date - The date to format
 * @returns Formatted string like "Mon, Jan 15, 2024 at 9:00 AM"
 */
export function formatSessionDateTime(date: Date): string {
  return date.toLocaleString('en-AU', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Adelaide'
  });
}

