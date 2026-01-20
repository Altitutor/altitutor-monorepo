import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '../api/students';
import { studentsKeys } from './useStudentsQuery';
import type { Tables } from '@altitutor/shared';

/**
 * Hook for searching students in filter dropdowns
 * Supports status filtering and returns formatted student data
 */
export function useStudentSearchFilter(
  searchQuery: string,
  statuses: Tables<'students'>['status'][] = ['ACTIVE', 'TRIAL']
) {
  return useQuery({
    queryKey: [...studentsKeys.lists(), 'search-filter', searchQuery.trim(), statuses.sort().join(',')],
    queryFn: async () => {
      const trimmed = searchQuery.trim();
      
      if (trimmed.length === 0) {
        // Return empty array if no search query
        return { students: [], total: 0 };
      }
      
      // Use the existing searchStudents API with status filtering
      const students = await studentsApi.searchStudents(trimmed, statuses, false);
      
      return {
        students,
        total: students.length,
      };
    },
    enabled: searchQuery.trim().length > 0,
    staleTime: 1000 * 30, // 30 seconds stale time
    gcTime: 1000 * 60 * 2, // 2 minutes
  });
}
