import { collectTableRows } from '@/shared/utils/tablePages';
import { compareTimeSinceCheckIn } from '@/features/reconciliation/api/checkInDates';
import { useCheckInDates } from '@/features/reconciliation/api/useCheckInDates';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { parentsApi, type ParentSearchField } from '../api/parents';
import type { Tables, TablesInsert, TablesUpdate, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export const parentsKeys = {
  all: () => ['parents'] as const,
  lists: () => [...parentsKeys.all(), 'list'] as const,
  list: (params: {
    search?: string;
    searchFields?: ParentSearchField[];
    page?: number;
    pageSize?: number;
    orderBy?: keyof Tables<'parents'>;
    ascending?: boolean;
  }) => [...parentsKeys.lists(), params] as const,
  detail: (id: string) => [...parentsKeys.all(), 'detail', id] as const,
};

export interface UseParentsListParams {
  search?: string;
  searchFields?: ParentSearchField[];
  page?: number;
  pageSize?: number;
  orderBy?: keyof Tables<'parents'>;
  ascending?: boolean;
  sortByCheckIn?: boolean;
}

export function useParentsList(params: UseParentsListParams) {
  const {
    search = '',
    searchFields = ['name', 'email', 'phone'],
    page = 1,
    pageSize = 50,
    orderBy = 'last_name',
    ascending = true,
    sortByCheckIn = false,
  } = params || {};

  const offset = (Math.max(page, 1) - 1) * pageSize;

  const checkIns = useCheckInDates('parent', sortByCheckIn);
  return useQuery({
    queryKey: [...parentsKeys.list({ search, searchFields, orderBy, ascending, page, pageSize }), sortByCheckIn ? checkIns.dataUpdatedAt : null],
    enabled: !sortByCheckIn || !!checkIns.data || checkIns.isError,
    queryFn: async () => {
      const args = { search, searchFields, orderBy, ascending };
      if (!sortByCheckIn) return parentsApi.list({ ...args, limit: pageSize, offset });
      if (checkIns.error) throw checkIns.error;
      const rows = await collectTableRows(async (offset, limit) => {
        const result = await parentsApi.list({ ...args, orderBy: 'last_name', ascending: true, offset, limit });
        return { rows: result.parents, total: result.total };
      });
      rows.sort((a, b) => compareTimeSinceCheckIn(checkIns.data?.[a.id], checkIns.data?.[b.id], ascending) || a.id.localeCompare(b.id));
      return { parents: rows.slice(offset, offset + pageSize), total: rows.length };
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 3, // 3 minutes
    gcTime: 1000 * 60 * 5,
  });
}

export function useCreateParent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: TablesInsert<'parents'>) => parentsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: parentsKeys.lists() });
    },
  });
}

export function useUpdateParent() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TablesUpdate<'parents'> }) => 
      parentsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: parentsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: parentsKeys.detail(variables.id) });
    },
  });
}

export function useDeleteParent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => parentsApi.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: parentsKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: parentsKeys.lists() });
    },
  });
}

export function useParentDetails(id: string | null, enabled: boolean = true) {
  return useQuery({
    queryKey: parentsKeys.detail(id || ''),
    queryFn: async () => {
      if (!id) return null;
      
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      const { data, error } = await supabase
        .from('parents')
        .select(`
          *,
          parents_students (
            id,
            students (*)
          )
        `)
        .eq('id', id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      // Extract students from the join
      type ParentStudentRow = { students: Tables<'students'> | null };
      const studentsList = data?.parents_students?.map((ps: ParentStudentRow) => ps.students).filter(Boolean) || [];
      
      return {
        parent: data as Tables<'parents'>,
        students: studentsList as Tables<'students'>[],
      };
    },
    enabled: enabled && !!id,
  });
}

