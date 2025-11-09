import { useQuery } from '@tanstack/react-query';
import { staffApi } from '../api/staff';

// Query Keys
export const staffKeys = {
  all: ['staff'] as const,
  current: () => [...staffKeys.all, 'current'] as const,
};

// Get current tutor's own profile (uses vtutor_profile view)
export function useCurrentStaff(enabled: boolean = true) {
  return useQuery({
    queryKey: staffKeys.current(),
    queryFn: staffApi.getCurrentProfile,
    enabled: enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes - user data doesn't change often
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}
