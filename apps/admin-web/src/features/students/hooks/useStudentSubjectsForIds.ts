import { useQuery } from '@tanstack/react-query';
import { studentsApi } from '../api/students';
import type { Tables } from '@altitutor/shared';

/**
 * Hook to fetch subjects for multiple student IDs
 * Used for displaying student subjects in parent/student views
 */
export function useStudentSubjectsForIds(
  studentIds: string[],
  enabled = true
) {
  const sortedIds = [...studentIds].sort().join(',');
  
  return useQuery({
    queryKey: ['student-subjects-for-ids', sortedIds],
    queryFn: () => studentsApi.getDetailsForStudentIds(studentIds),
    enabled: enabled && studentIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
    select: (data) => data.studentSubjects as Record<string, Tables<'subjects'>[]>,
  });
}
