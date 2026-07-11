import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  scoreProjectionSettingsApi,
  type ScoreProjectionSettingsUpdate,
} from "@/features/score-projection-settings/api/score-projection-settings";

const QUERY_KEY = ["admin", "score-projection-settings"] as const;

export function useScoreProjectionSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => scoreProjectionSettingsApi.getAll(),
  });
}

export function useUpdateScoreProjectionSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      updates: ScoreProjectionSettingsUpdate;
    }) => {
      await scoreProjectionSettingsApi.update(params.id, params.updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
