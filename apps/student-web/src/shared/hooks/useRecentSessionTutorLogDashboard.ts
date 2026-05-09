import { useQuery } from '@tanstack/react-query';
import { studentSessionsApi } from '@/shared/api/sessions';

export function useRecentSessionTutorLogDashboard(enabled = true) {
  return useQuery({
    queryKey: ['student', 'dashboard', 'recent-session-tutor-log'],
    queryFn: () => studentSessionsApi.getRecentSessionTutorLogForDashboard(),
    staleTime: 1000 * 60 * 3,
    enabled,
  });
}
