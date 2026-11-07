import { useQuery } from '@tanstack/react-query';
import { studentSessionsApi, type StudentSessionWithStaff } from '@/shared/api/sessions';

export function useStudentSessions(rangeStart: string, rangeEnd: string, enabled = true) {
  return useQuery<StudentSessionWithStaff[]>({
    queryKey: ['student', 'sessions', rangeStart, rangeEnd],
    queryFn: () => studentSessionsApi.list(rangeStart, rangeEnd),
    enabled,
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}
