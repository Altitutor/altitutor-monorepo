import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { keepPreviousData } from '@tanstack/react-query';
import { parentsApi } from '../api/parents';
import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';

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

