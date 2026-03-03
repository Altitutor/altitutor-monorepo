import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { parentsApi } from '../api/parents';
import type { Tables, TablesInsert, TablesUpdate, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

export const parentsKeys = {
  all: () => ['parents'] as const,
  lists: () => [...parentsKeys.all(), 'list'] as const,
  list: (params: {
    search?: string;
    page?: number;
    pageSize?: number;
    orderBy?: keyof Tables<'parents'>;
    ascending?: boolean;
  }) => [...parentsKeys.lists(), params] as const,
  detail: (id: string) => [...parentsKeys.all(), 'detail', id] as const,
};

export interface UseParentsListParams {
  search?: string;
  page?: number;
  pageSize?: number;
  orderBy?: keyof Tables<'parents'>;
  ascending?: boolean;
}

export function useParentsList(params: UseParentsListParams) {
  const {
    search = '',
    page = 1,
    pageSize = 50,
    orderBy = 'last_name',
    ascending = true,
  } = params || {};

  const offset = (Math.max(page, 1) - 1) * pageSize;

  return useQuery({
    queryKey: parentsKeys.list({ search, page, pageSize, orderBy, ascending }),
    queryFn: () => parentsApi.list({ search, limit: pageSize, offset, orderBy, ascending }),
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

