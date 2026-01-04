import type { ClassWithExpandedSubject } from '@altitutor/shared';
import type { Tables } from '@altitutor/shared';

/**
 * Filter classes for change class modal (same subject only, exclude old class)
 */
export function filterClassesForChange(
  classes: ClassWithExpandedSubject[],
  oldClass: Tables<'classes'>,
  searchQuery: string
): ClassWithExpandedSubject[] {
  return classes.filter(c => {
    // Only show classes with the same subject
    if (c.subject_id !== oldClass.subject_id) return false;
    
    // Exclude the old class itself
    if (c.id === oldClass.id) return false;
    
    // Search filter
    if (searchQuery.trim() && c.subject) {
      const query = searchQuery.toLowerCase();
      const subjectName = c.subject.name.toLowerCase();
      if (!subjectName.includes(query)) return false;
    }
    
    return true;
  });
}

