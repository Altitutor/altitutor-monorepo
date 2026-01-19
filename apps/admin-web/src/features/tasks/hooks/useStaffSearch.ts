import { useQuery } from '@tanstack/react-query';
import { staffApi } from '@/features/staff/api/staff';
import type { Tables } from '@altitutor/shared';

/**
 * Hook for searching staff for task assignment
 * Returns admin staff by default, all staff when searching
 */
export function useStaffSearch(searchQuery: string, enabled: boolean) {
  const trimmedQuery = searchQuery.trim();
  const hasQuery = trimmedQuery.length > 0;

  // Query for admin staff (default, when no search query)
  const { data: adminStaff = [], isLoading: isLoadingAdmin } = useQuery({
    queryKey: ['staff', 'admin', 'tasks', 'search'],
    queryFn: () => staffApi.searchForTasks({ role: 'ADMINSTAFF' }),
    enabled: enabled && !hasQuery,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Query for all staff when searching
  const { data: allStaff = [], isLoading: isLoadingSearch } = useQuery({
    queryKey: ['staff', 'search', 'tasks', trimmedQuery],
    queryFn: () => staffApi.searchForTasks({ search: trimmedQuery }),
    enabled: enabled && hasQuery,
    staleTime: 1000 * 30, // 30 seconds
  });

  return {
    staff: hasQuery ? allStaff : adminStaff,
    isLoading: hasQuery ? isLoadingSearch : isLoadingAdmin,
  };
}
