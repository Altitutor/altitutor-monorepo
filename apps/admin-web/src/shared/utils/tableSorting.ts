/**
 * Utility functions for table sorting and filtering
 * Extracted from components to follow separation of concerns
 */

import type { Tables } from '@altitutor/shared';

/**
 * Sort students by status with secondary sort by first_name
 */
export function sortStudentsByStatus(
  students: Tables<'students'>[],
  sortDirection: 'asc' | 'desc'
): Tables<'students'>[] {
  if (!students.length) return students;

  return [...students].sort((a, b) => {
    const aStatus = String(a.status || '');
    const bStatus = String(b.status || '');
    
    const statusComparison = aStatus.localeCompare(bStatus);
    const primarySort = sortDirection === 'asc' ? statusComparison : -statusComparison;
    
    // If status values are equal, sort by first_name
    if (statusComparison === 0) {
      const aFirstName = String(a.first_name || '');
      const bFirstName = String(b.first_name || '');
      return aFirstName.localeCompare(bFirstName);
    }
    
    return primarySort;
  });
}

/**
 * Filter classes by search term (searches subject display name)
 */
export function filterClassesBySearch(
  classes: Tables<'classes'>[],
  searchTerm: string,
  getSubjectDisplay: (classItem: Tables<'classes'>) => string
): Tables<'classes'>[] {
  if (!searchTerm) return classes;
  
  const searchLower = searchTerm.toLowerCase();
  return classes.filter(cls => {
    const subjectDisplay = getSubjectDisplay(cls).toLowerCase();
    return subjectDisplay.includes(searchLower);
  });
}

/**
 * Filter classes by day of week (multi-select)
 */
export function filterClassesByDay(
  classes: Tables<'classes'>[],
  dayFilter: number[]
): Tables<'classes'>[] {
  if (dayFilter.length === 0) return classes;
  return classes.filter(cls => dayFilter.includes(cls.day_of_week));
}

/**
 * Sort classes by day of week (Monday-Sunday), then by start time
 */
export function sortClassesByDayAndTime(classes: Tables<'classes'>[]): Tables<'classes'>[] {
  return [...classes].sort((a, b) => {
    // First sort by day (Monday=1, Tuesday=2, etc., Sunday=0 should be last)
    const dayA = a.day_of_week === 0 ? 7 : a.day_of_week; // Move Sunday to end
    const dayB = b.day_of_week === 0 ? 7 : b.day_of_week;
    
    if (dayA !== dayB) {
      return dayA - dayB;
    }
    
    // If same day, sort by start time
    const timeA = timeToMinutes(a.start_time);
    const timeB = timeToMinutes(b.start_time);
    return timeA - timeB;
  });
}

/**
 * Convert time string (HH:MM) to minutes for comparison
 */
function timeToMinutes(timeString: string): number {
  if (!timeString) return 0;
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}
