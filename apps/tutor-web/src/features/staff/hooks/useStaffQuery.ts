import { useQuery } from '@tanstack/react-query';
import { staffApi } from '../api/staff';
import { useAuthStore } from '@/shared/lib/supabase/auth';

// Query Keys
export const staffKeys = {
  all: ['staff'] as const,
  current: (userId?: string) => [...staffKeys.all, 'current', userId ?? null] as const,
};

// Get current tutor's own profile (uses vtutor_profile view)
export function useCurrentStaff(enabled: boolean = true) {
  const userId = useAuthStore((state) => state.user?.id);

  return useQuery({
    queryKey: staffKeys.current(userId),
    queryFn: staffApi.getCurrentProfile,
    enabled: enabled && Boolean(userId),
    staleTime: 30_000,
    gcTime: 1000 * 60 * 15, // 15 minutes
  });
}
