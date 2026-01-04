import type { ClassWithExpandedSubject } from '@altitutor/shared';
import type { Tables } from '@altitutor/shared';
import { getDayOfWeek } from '@/shared/utils/datetime';

/**
 * Filter classes for change class modal (same subject only, exclude old class)
 * Supports search by day, time, staff, or student names, plus day filter
 */
export function filterClassesForChange(
  classes: ClassWithExpandedSubject[],
  oldClass: Tables<'classes'>,
  searchQuery: string,
  dayFilters: number[] = []
): ClassWithExpandedSubject[] {
  return classes.filter(c => {
    // Only show classes with the same subject
    if (c.subject_id !== oldClass.subject_id) return false;
    
    // Exclude the old class itself
    if (c.id === oldClass.id) return false;
    
    // Day filter
    if (dayFilters.length > 0) {
      if (!dayFilters.includes(c.day_of_week)) return false;
    }
    
    // Search filter - filter by day, time, staff member, or student name
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      let matches = false;
      
      // Match day of week
      if (c.day_of_week !== undefined) {
        const dayName = getDayOfWeek(c.day_of_week).toLowerCase();
        if (dayName.includes(query)) {
          matches = true;
        }
      }
      
      // Match time (start_time or end_time)
      if (c.start_time && c.start_time.toLowerCase().includes(query)) {
        matches = true;
      }
      if (c.end_time && c.end_time.toLowerCase().includes(query)) {
        matches = true;
      }
      
      // Match staff member names
      if (c.staff && c.staff.length > 0) {
        const staffNames = c.staff.map(s => 
          `${s.first_name} ${s.last_name}`.toLowerCase()
        );
        if (staffNames.some(name => name.includes(query))) {
          matches = true;
        }
      }
      
      // Match student names
      if (c.students && c.students.length > 0) {
        const studentNames = c.students.map(s => 
          `${s.first_name} ${s.last_name}`.toLowerCase()
        );
        if (studentNames.some(name => name.includes(query))) {
          matches = true;
        }
      }
      
      if (!matches) return false;
    }
    
    return true;
  });
}

