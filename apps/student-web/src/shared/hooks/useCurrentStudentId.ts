import { useQuery } from '@tanstack/react-query';
import { currentStudentApi } from '@/shared/api/current-student';

export function useCurrentStudentId() {
  return useQuery({
    queryKey: ['student', 'current-id'],
    queryFn: currentStudentApi.getId,
    staleTime: 1000 * 60 * 5, // 5 minutes - student ID rarely changes
  });
}
