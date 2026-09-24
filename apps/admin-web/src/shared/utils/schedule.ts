import { getProjectedClassScheduleRows } from '@altitutor/shared';
import type { Json, Tables } from '@altitutor/shared';

type ClassScheduleProjection = Pick<Tables<'classes'>, 'day_of_week' | 'start_time'> & {
  schedule_rows?: Json | null;
  schedule_frequency_weeks?: number | null;
  schedule_anchor_date?: string | null;
};

function getScheduleStarts(classData: ClassScheduleProjection) {
  const projectedRows = getProjectedClassScheduleRows(classData.schedule_rows);
  return projectedRows.length > 0 ? projectedRows : [classData];
}

function daysBetweenCalendarDates(left: Date, right: Date): number {
  const leftUtc = Date.UTC(left.getFullYear(), left.getMonth(), left.getDate());
  const rightUtc = Date.UTC(right.getFullYear(), right.getMonth(), right.getDate());
  return Math.round((leftUtc - rightUtc) / 86_400_000);
}

function matchesRecurrenceWeek(date: Date, classData: ClassScheduleProjection): boolean {
  const frequencyWeeks = classData.schedule_frequency_weeks ?? 1;
  if (frequencyWeeks === 1 || !classData.schedule_anchor_date) return true;
  const [year, month, day] = classData.schedule_anchor_date.split('-').map(Number);
  const anchor = new Date(year, month - 1, day);
  return Math.floor(daysBetweenCalendarDates(date, anchor) / 7) % frequencyWeeks === 0;
}

/**
 * Calculate the first session date for a class on or after the enrollment date
 * @param classData - The class with day_of_week and start_time
 * @param enrollmentDate - The enrollment date (at midnight Adelaide time)
 * @returns Date object of the first session on/after enrollmentDate
 */
export function calculateFirstSessionDate(
  classData: ClassScheduleProjection,
  enrollmentDate: Date
): Date {
  const candidates = getScheduleStarts(classData).map((row) => {
    let daysUntilClass = row.day_of_week - enrollmentDate.getDay();
    if (daysUntilClass < 0) daysUntilClass += 7;

    const candidate = new Date(enrollmentDate);
    candidate.setDate(candidate.getDate() + daysUntilClass);
    while (!matchesRecurrenceWeek(candidate, classData)) {
      candidate.setDate(candidate.getDate() + 7);
    }
    const [hours, minutes] = row.start_time.split(':').map(Number);
    candidate.setHours(hours, minutes, 0, 0);
    return candidate;
  });

  return candidates.reduce((earliest, candidate) =>
    candidate < earliest ? candidate : earliest
  );
}

/**
 * Calculate the last session date for a class before the unenrollment date
 * @param classData - The class with day_of_week and start_time
 * @param unenrollmentDate - The unenrollment date (at midnight Adelaide time)
 * @returns Date object of the last session before unenrollmentDate, or null if no session exists
 */
export function calculateLastSessionDate(
  classData: ClassScheduleProjection,
  unenrollmentDate: Date
): Date | null {
  const candidates = getScheduleStarts(classData).map((row) => {
    let daysBackToClass = unenrollmentDate.getDay() - row.day_of_week;
    if (daysBackToClass <= 0) daysBackToClass += 7;

    const candidate = new Date(unenrollmentDate);
    candidate.setDate(candidate.getDate() - daysBackToClass);
    while (!matchesRecurrenceWeek(candidate, classData)) {
      candidate.setDate(candidate.getDate() - 7);
    }
    const [hours, minutes] = row.start_time.split(':').map(Number);
    candidate.setHours(hours, minutes, 0, 0);
    return candidate;
  }).filter((candidate) => candidate < unenrollmentDate);

  if (candidates.length === 0) return null;
  return candidates.reduce((latest, candidate) => candidate > latest ? candidate : latest);
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
