import { useQuery } from '@tanstack/react-query';
import { bookingSettingsApi } from '../api/settings';

export function useSessionDurationMinutes(
  sessionType: 'DRAFTING' | 'TRIAL_SESSION' | 'SUBSIDY_INTERVIEW',
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['booking-settings', 'duration', sessionType],
    queryFn: () => bookingSettingsApi.getSessionDurationMinutes(sessionType),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    enabled: options?.enabled !== false, // Default to enabled unless explicitly disabled
  });
}

