import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import { getDayOfWeek } from '@/shared/utils/datetime';
import type { StudentWithEnrollmentInfo, EnrollmentFilters } from '../types/enrollment';

/**
 * Filter students based on search query and enrollment status
 */
export function filterStudents(
  students: StudentWithEnrollmentInfo[],
  filters: EnrollmentFilters,
  enrolledStudentIds: string[]
): StudentWithEnrollmentInfo[] {
  return students.filter(s => {
    // Exclude already enrolled students in this specific class
    if (enrolledStudentIds.includes(s.id)) return false;
    
    // Only show ACTIVE students for enrollment
    if (s.status !== 'ACTIVE') return false;
    
    // Search filter
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      const fullName = `${s.first_name} ${s.last_name}`.toLowerCase();
      if (!fullName.includes(query)) return false;
    }
    
    return true;
  });
}

/**
 * Filter classes based on search query, day filters, and enrollment status
 */
export function filterClasses(
  classes: ClassWithExpandedSubject[],
  filters: EnrollmentFilters,
  enrolledClassIds: string[]
): ClassWithExpandedSubject[] {
  return classes.filter(c => {
    // Exclude already enrolled classes
    if (enrolledClassIds.includes(c.id)) return false;
    
    // Day filter
    if (filters.dayFilters.length > 0) {
      if (!filters.dayFilters.includes(c.day_of_week)) return false;
    }
    
    // Search filter - filter by day, time, staff member, or student name
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
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

/**
 * Get available year levels from students or classes
 */
export function getAvailableYearLevels(
  students: StudentWithEnrollmentInfo[],
  classes: ClassWithExpandedSubject[],
  context: 'class' | 'student'
): number[] {
  const levels = new Set<number>();
  if (context === 'class') {
    students.forEach(s => s.year_level && levels.add(s.year_level));
  } else {
    classes.forEach(c => c.subject?.year_level && levels.add(c.subject.year_level));
  }
  return Array.from(levels).sort((a, b) => a - b);
}

/**
 * Get available subjects from students or classes
 */
export function getAvailableSubjects(
  students: StudentWithEnrollmentInfo[],
  classes: ClassWithExpandedSubject[],
  context: 'class' | 'student',
  subjectId?: string
): Tables<'subjects'>[] {
  // Subject filters are not used in student context when subjectId is provided
  if (context === 'student' && subjectId) {
    return [];
  }
  
  const subjectMap = new Map<string, Tables<'subjects'>>();
  if (context === 'class') {
    students.forEach(s => {
      s.subjects?.forEach(sub => {
        if (!subjectMap.has(sub.id)) {
          subjectMap.set(sub.id, sub);
        }
      });
    });
  } else {
    classes.forEach(c => {
      if (c.subject && !subjectMap.has(c.subject.id)) {
        subjectMap.set(c.subject.id, c.subject);
      }
    });
  }
  return Array.from(subjectMap.values());
}

/**
 * Get available days from classes
 */
export function getAvailableDays(classes: ClassWithExpandedSubject[]): number[] {
  const days = new Set<number>();
  classes.forEach(c => days.add(c.day_of_week));
  return Array.from(days).sort((a, b) => a - b);
}

