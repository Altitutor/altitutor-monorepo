import { useQuery } from '@tanstack/react-query';
import { staffApi } from '@/features/staff/api/staff';
import type { Tables } from '@altitutor/shared';

export interface UseStaffSearchOptions {
  enabled?: boolean;
  statuses?: Tables<'staff'>['status'][];
  limit?: number;
}

/**
 * Hook for searching staff using the staff API
 * Reusable across components that need staff search functionality
 */
export function useStaffSearch(
  searchQuery: string,
  options: UseStaffSearchOptions = {}
) {
  const {
    enabled = true,
    statuses = ['ACTIVE'],
    limit = 100,
  } = options;

  return useQuery({
    queryKey: ['staff', 'search', 'admin', searchQuery.trim(), statuses, limit],
    queryFn: async () => {
      const result = await staffApi.listMinimal({
        search: searchQuery.trim() || undefined,
        statuses,
        limit,
        offset: 0,
        orderBy: 'last_name',
        ascending: true,
        excludeClassSearch: false,
      });
      
      // Transform to match Tables<'staff'> format
      return {
        staff: result.staff.map((s) => ({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          role: s.role,
          status: s.status,
          email: s.email,
          phone_number: s.phone_number,
          created_at: null,
          updated_at: null,
        })) as Tables<'staff'>[],
        total: result.total,
      };
    },
    enabled: enabled,
    staleTime: 1000 * 30, // 30 seconds
  });
}
