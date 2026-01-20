/**
 * Utility functions for filtering data
 * Extracted from components to follow separation of concerns
 */

/**
 * Filter staff list to exclude staff already in a session
 */
export function filterAvailableStaff<T extends { id: string }>(
  allStaff: T[],
  existingStaffIds: Set<string>
): T[] {
  return allStaff.filter((staff) => !existingStaffIds.has(staff.id));
}

/**
 * Filter students by search query and status
 */
export function filterStudentsBySearch<T extends { 
  first_name: string | null; 
  last_name: string | null; 
  status: string;
}>(
  students: T[],
  searchQuery: string,
  statusFilter: string[] = ['ACTIVE'],
  limit?: number
): T[] {
  if (!searchQuery.trim()) return [];
  
  const query = searchQuery.toLowerCase();
  let filtered = students.filter((student) => {
    // Filter by status
    if (statusFilter.length > 0 && !statusFilter.includes(student.status)) {
      return false;
    }
    
    // Filter by search query
    const firstName = (student.first_name || '').toLowerCase();
    const lastName = (student.last_name || '').toLowerCase();
    const fullName = `${firstName} ${lastName}`;
    
    return (
      firstName.includes(query) ||
      lastName.includes(query) ||
      fullName.includes(query)
    );
  });
  
  // Apply limit if specified
  if (limit !== undefined) {
    filtered = filtered.slice(0, limit);
  }
  
  return filtered;
}
