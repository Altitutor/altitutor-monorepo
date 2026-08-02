"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchUcatInterfacePreferences,
  patchUcatInterfacePreferences,
} from "@/features/interface-preferences/api/interface-preferences-api";
import {
  DEFAULT_UCAT_INTERFACE_PREFERENCES,
  type UcatInterfacePreferences,
} from "@/features/interface-preferences/model/types";

export const UCAT_INTERFACE_PREFERENCES_QUERY_KEY = [
  "ucat-interface-preferences",
] as const;

export function useUcatInterfacePreferences() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: UCAT_INTERFACE_PREFERENCES_QUERY_KEY,
    queryFn: fetchUcatInterfacePreferences,
    staleTime: 5 * 60 * 1000,
  });
  const mutation = useMutation({
    mutationFn: patchUcatInterfacePreferences,
    onMutate: async (patch: Partial<UcatInterfacePreferences>) => {
      await queryClient.cancelQueries({
        queryKey: UCAT_INTERFACE_PREFERENCES_QUERY_KEY,
      });
      const previous = queryClient.getQueryData<UcatInterfacePreferences>(
        UCAT_INTERFACE_PREFERENCES_QUERY_KEY,
      );
      queryClient.setQueryData<UcatInterfacePreferences>(
        UCAT_INTERFACE_PREFERENCES_QUERY_KEY,
        { ...(previous ?? DEFAULT_UCAT_INTERFACE_PREFERENCES), ...patch },
      );
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          UCAT_INTERFACE_PREFERENCES_QUERY_KEY,
          context.previous,
        );
      }
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(
        UCAT_INTERFACE_PREFERENCES_QUERY_KEY,
        preferences,
      );
    },
  });

  return {
    ...query,
    preferences: query.data ?? DEFAULT_UCAT_INTERFACE_PREFERENCES,
    updatePreferences: mutation.mutateAsync,
    isSaving: mutation.isPending,
  };
}
