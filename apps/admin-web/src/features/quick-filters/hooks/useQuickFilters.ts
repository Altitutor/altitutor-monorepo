import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quickFiltersApi } from '../api/quick-filters';
import { QuickFilter } from '@altitutor/shared';

const quickFiltersKeys = {
  all: ['quick-filters'] as const,
  lists: () => [...quickFiltersKeys.all, 'list'] as const,
  list: (entity: string) => [...quickFiltersKeys.lists(), entity] as const,
};

export function useQuickFilters(entity?: string) {
  return useQuery({
    queryKey: entity ? quickFiltersKeys.list(entity) : quickFiltersKeys.lists(),
    queryFn: () => entity ? quickFiltersApi.list(entity) : quickFiltersApi.listAll(),
  });
}

export function useCreateQuickFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: quickFiltersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quickFiltersKeys.all });
    },
  });
}

export function useUpdateQuickFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<QuickFilter> }) =>
      quickFiltersApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quickFiltersKeys.all });
    },
  });
}

export function useDeleteQuickFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: quickFiltersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quickFiltersKeys.all });
    },
  });
}
