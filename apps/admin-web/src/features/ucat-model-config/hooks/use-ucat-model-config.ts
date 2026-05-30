import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ucatModelConfigApi,
  type UcatModelConfigUpdate,
} from "@/features/ucat-model-config/api/ucat-model-config";

const QUERY_KEY = ["admin", "ucat-model-config"] as const;

export function useUcatModelConfig() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => ucatModelConfigApi.getAll(),
  });
}

export function useUpdateUcatModelConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { id: string; updates: UcatModelConfigUpdate }) => {
      await ucatModelConfigApi.update(params.id, params.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
