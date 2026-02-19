import { useQuery } from '@tanstack/react-query';
import { staffApi } from '@/features/staff/api/staff';
import type { Tables } from '@altitutor/shared';

export function useStaffSearchForFilter(searchQuery: string) {
  const trimmed = searchQuery.trim();

  return useQuery({
    queryKey: ['staff', 'search-filter', trimmed],
    queryFn: async () => {
      const result = await staffApi.listMinimal({
        search: trimmed,
        statuses: ['ACTIVE'],
        limit: 100,
        offset: 0,
        orderBy: 'last_name',
        ascending: true,
        excludeClassSearch: false,
      });

      return {
        staff: (result.staff || []) as Tables<'staff'>[],
        total: result.total || 0,
      };
    },
    staleTime: 1000 * 30,
  });
}
