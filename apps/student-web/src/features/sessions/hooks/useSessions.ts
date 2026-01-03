import { useQuery } from '@tanstack/react-query';
import { sessionsApi, type StudentSessionWithStaff } from '../api/sessions';

export function useStudentSessions(rangeStart: string, rangeEnd: string) {
  return useQuery<StudentSessionWithStaff[]>({
    queryKey: ['student', 'sessions', rangeStart, rangeEnd],
    queryFn: () => sessionsApi.list(rangeStart, rangeEnd),
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}
