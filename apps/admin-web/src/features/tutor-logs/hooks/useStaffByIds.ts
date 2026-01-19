import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { staffKeys } from '@/features/staff/hooks/useStaffQuery';

/**
 * Hook for fetching staff members by their IDs
 * Returns a map of staff ID to staff name info
 */
export function useStaffByIds(staffIds: string[]) {
  return useQuery({
    queryKey: [...staffKeys.all, 'by-ids', staffIds.sort().join(',')],
    queryFn: async () => {
      if (staffIds.length === 0) return {};
      
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('staff')
        .select('id, first_name, last_name')
        .in('id', staffIds);
      
      if (error) throw error;
      
      const staffMap: Record<string, { first_name: string; last_name: string }> = {};
      (data || []).forEach((s) => {
        staffMap[s.id] = { first_name: s.first_name, last_name: s.last_name };
      });
      
      return staffMap;
    },
    enabled: staffIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
