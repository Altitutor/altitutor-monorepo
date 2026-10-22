import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { quickFiltersApi } from "../api/quick-filters";
import { useMemo } from "react";
import {
  encodeViewConfig,
  type DisplaySettings,
  type QuickFilter,
} from "@altitutor/shared";

const quickFiltersKeys = {
  all: ["quick-filters"] as const,
  lists: () => [...quickFiltersKeys.all, "list"] as const,
  list: (entity: string) => [...quickFiltersKeys.lists(), entity] as const,
};

export function useQuickFilters(
  entity?: string,
  defaultView?: { name: string; settings: DisplaySettings },
) {
  const query = useQuery({
    queryKey: entity ? quickFiltersKeys.list(entity) : quickFiltersKeys.lists(),
    queryFn: () =>
      entity ? quickFiltersApi.list(entity) : quickFiltersApi.listAll(),
  });
  const data = useMemo(() => {
    if (!defaultView || !entity) return query.data;
    const builtIn: QuickFilter = {
      id: `builtin:${entity}:default`,
      name: defaultView.name,
      target_entity: entity,
      user_id: null,
      created_at: "",
      updated_at: "",
      config: encodeViewConfig(defaultView.settings),
    };
    return [builtIn, ...(query.data ?? [])];
  }, [query.data, entity, defaultView]);
  return { ...query, data };
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
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<QuickFilter>;
    }) => quickFiltersApi.update(id, updates),
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
