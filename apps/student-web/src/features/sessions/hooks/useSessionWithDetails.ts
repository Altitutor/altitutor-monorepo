import { useQuery } from '@tanstack/react-query';
import { studentSessionsApi } from '@/shared/api/sessions';

export function useSessionWithDetails(sessionId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['student', 'session', sessionId],
    queryFn: () => studentSessionsApi.getSessionWithDetails(sessionId!),
    enabled: !!sessionId && enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
