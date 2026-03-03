import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '@altitutor/shared';

/**
 * Hook for searching students in filter dropdowns
 * Uses RPC search_students_admin to support both search and "show all" scenarios
 */
export function useStudentSearchForFilter(
  searchQuery: string,
  statuses: Tables<'students'>['status'][] = ['ACTIVE', 'TRIAL']
) {
  return useQuery({
    queryKey: ['students', 'search-filter', 'rpc', searchQuery.trim(), statuses.sort().join(',')],
    queryFn: async () => {
      const trimmed = searchQuery.trim();
      const supabase = getSupabaseClient() as SupabaseClient<Database>;

      // Use server-side search function to avoid pagination limits
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_students_admin', {
        p_search: trimmed.length > 0 ? trimmed : undefined,
        p_statuses: statuses,
        p_include_relationships: false,
        p_exclude_class_search: false,
        p_limit: 100, // Limit to 100 results for filter dropdown
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return { students: [], total: 0 };

      type RpcStudent = Pick<Tables<'students'>, 'id' | 'first_name' | 'last_name' | 'status' | 'curriculum' | 'year_level' | 'school' | 'email' | 'phone' | 'created_at' | 'updated_at'>;
      const rpcData = rpcResult as { students: RpcStudent[]; total: number };
      const students = (rpcData.students || []).map((s: RpcStudent) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        status: s.status,
        curriculum: s.curriculum || null,
        year_level: s.year_level || null,
        school: s.school || null,
        email: s.email || null,
        phone: s.phone || null,
        created_at: s.created_at || null,
        updated_at: s.updated_at || null,
      })) as Tables<'students'>[];

      return { students, total: rpcData.total || 0 };
    },
    enabled: true, // Always enabled - RPC handles empty search by returning all students
    staleTime: 1000 * 30, // 30 seconds stale time
  });
}
