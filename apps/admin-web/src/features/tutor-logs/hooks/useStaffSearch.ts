import { useQuery } from '@tanstack/react-query';
import { staffApi } from '@/features/staff/api/staff';
import { staffKeys } from '@/features/staff/hooks/useStaffQuery';

/**
 * Hook for searching staff members (used in filters/pickers)
 * Uses the same RPC function as StaffTable for consistency
 */
export function useStaffSearch(searchQuery: string, options?: { enabled?: boolean }) {
  const trimmed = searchQuery.trim();
  
  return useQuery({
    queryKey: [...staffKeys.all, 'search', trimmed],
    queryFn: () =>
      staffApi.listMinimal({
        search: trimmed,
        statuses: ['ACTIVE'],
        limit: 100,
        offset: 0,
        orderBy: 'last_name',
        ascending: true,
        excludeClassSearch: false,
      }),
    enabled: (options?.enabled ?? true) && trimmed.length > 0,
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 2, // 2 minutes
  });
}
