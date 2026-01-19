import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';
import { studentsKeys } from '../../students/hooks/useStudentsQuery';

/**
 * Hook to fetch multiple students by their IDs
 */
export function useStudentsByIds(studentIds: string[]) {
  return useQuery({
    queryKey: [...studentsKeys.all, 'byIds', studentIds.sort().join(',')],
    queryFn: async (): Promise<Tables<'students'>[]> => {
      if (studentIds.length === 0) {
        return [];
      }

      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .in('id', studentIds);

      if (error) {
        console.error('Error fetching students by IDs:', error);
        throw error;
      }

      return (data ?? []) as Tables<'students'>[];
    },
    enabled: studentIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
