import { useQuery } from '@tanstack/react-query';
import { currentStudentApi } from '@/shared/api/current-student';
import { useAuth } from '@/features/auth';

export function useCurrentStudentId() {
  const { session, isLoading } = useAuth();

  return useQuery({
    queryKey: ['student', 'current-id'],
    queryFn: currentStudentApi.getId,
    enabled: !isLoading && Boolean(session),
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes - student ID rarely changes
  });
}
