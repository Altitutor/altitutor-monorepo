/**
 * QuickBooks Export Configuration
 * 
 * This file contains all configurable settings for QuickBooks timesheet CSV export.
 * Modify these values to adjust pay category mappings, priority orders, etc.
 */

import type { Database } from '@altitutor/shared';

type SessionType = Database['public']['Enums']['session_type'];
type StaffAttendanceType = 'MAIN_TUTOR' | 'SECONDARY_TUTOR' | 'TRIAL_TUTOR';

/**
 * Pay category external IDs for QuickBooks
 * These must match exactly what's configured in QuickBooks
 */
export const PAY_CATEGORIES = {
  ADMIN: 'Admin',
  HOMEWORK_HELP: 'Homework help',
  TRAINING: 'Training',
  SECONDARY_TUTOR: 'Secondary tutor',
  MAIN_TUTOR: 'Main tutor',
} as const;

export type PayCategory = typeof PAY_CATEGORIES[keyof typeof PAY_CATEGORIES];

/**
 * Session type priority for overlapping sessions
 * Higher priority sessions reduce units of lower priority sessions
 * Priority order: meeting > class > adminshift
 * 
 * Note: "meeting" refers to TRIAL_SESSION and SUBSIDY_INTERVIEW types
 * If two sessions of the same type overlap, the first one (by start time) is kept
 */
export const SESSION_TYPE_PRIORITY: Partial<Record<SessionType, number>> = {
  TRIAL_SESSION: 3, // Highest priority (meeting)
  SUBSIDY_INTERVIEW: 3, // Highest priority (meeting)
  STAFF_INTERVIEW: 3, // Highest priority (meeting)
  CLASS: 2, // Medium priority
  DRAFTING: 2, // Medium priority (treated as class)
  EXAM_COURSE: 2, // Medium priority (treated as class)
  ADMIN_SHIFT: 1, // Lowest priority
};

/**
 * Get priority for a session type, defaulting to 0 if not specified
 */
export function getSessionPriority(sessionType: SessionType): number {
  return SESSION_TYPE_PRIORITY[sessionType] ?? 0;
}

/**
 * Determines the pay category for a tutor log entry based on session and attendance data
 * Returns the pay category external ID or null if no match
 * 
 * Priority order (descending):
 * 1. Admin - if session.type = ADMIN_SHIFT
 * 2. Homework help - if session.subject.name = 'Homework Help'
 * 3. Training - if staff_attendance.type = TRIAL_TUTOR
 * 4. Secondary tutor - if staff_attendance.type = SECONDARY_TUTOR
 * 5. Main tutor - if staff_attendance.type = MAIN_TUTOR (regardless of student count)
 */
export function determinePayCategory(params: {
  sessionType: SessionType;
  subjectName: string | null;
  staffAttendanceType: StaffAttendanceType | null;
  attendedStudentCount: number;
}): PayCategory | null {
  const { sessionType, subjectName, staffAttendanceType } = params;

  // 1. Admin - highest priority
  if (sessionType === 'ADMIN_SHIFT') {
    return PAY_CATEGORIES.ADMIN;
  }

  // 2. Homework help
  if (subjectName === 'Homework Help') {
    return PAY_CATEGORIES.HOMEWORK_HELP;
  }

  // 3. Training
  if (staffAttendanceType === 'TRIAL_TUTOR') {
    return PAY_CATEGORIES.TRAINING;
  }

  // 4. Secondary tutor
  if (staffAttendanceType === 'SECONDARY_TUTOR') {
    return PAY_CATEGORIES.SECONDARY_TUTOR;
  }

  // 5. Main tutor (regardless of student count)
  if (staffAttendanceType === 'MAIN_TUTOR') {
    return PAY_CATEGORIES.MAIN_TUTOR;
  }

  // No match found
  return null;
}

/**
 * Generate employee external ID from staff name
 * Format: {firstinitial}{lastname} (all lowercase)
 * Example: "Matthew Chua" -> "mchua"
 */
export function generateEmployeeExternalId(firstName: string, lastName: string): string {
  const firstInitial = firstName.trim().charAt(0).toLowerCase();
  const lastnameLower = lastName.trim().toLowerCase();
  return `${firstInitial}${lastnameLower}`;
}

/**
 * Get default date range for export
 * Returns: { startDate, endDate } where:
 * - endDate: last Sunday that occurred
 * - startDate: Monday 2 weeks before that Sunday (inclusive)
 */
export function getDefaultDateRange(): { startDate: string; endDate: string } {
  const today = new Date();
  
  // Find last Sunday
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysSinceSunday = dayOfWeek === 0 ? 0 : dayOfWeek;
  const lastSunday = new Date(today);
  lastSunday.setDate(today.getDate() - daysSinceSunday);
  lastSunday.setHours(0, 0, 0, 0);
  
  // Start date: Monday 2 weeks before last Sunday (14 days before)
  const startDate = new Date(lastSunday);
  startDate.setDate(lastSunday.getDate() - 13); // 13 days back = Monday 2 weeks before
  
  // Format as YYYY-MM-DD
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    startDate: formatDate(startDate),
    endDate: formatDate(lastSunday),
  };
}
