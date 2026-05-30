import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getStudyPlannerSettings,
  patchStudyPlannerSettings,
} from "@/features/study-planner/api/study-planner";

export const STUDY_PLANNER_SETTINGS_QUERY_KEY = [
  "ucat",
  "study-planner",
  "settings",
] as const;

export function useStudyPlannerSettings() {
  return useQuery({
    queryKey: STUDY_PLANNER_SETTINGS_QUERY_KEY,
    queryFn: getStudyPlannerSettings,
  });
}

export function useUpdateStudyPlannerSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: patchStudyPlannerSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STUDY_PLANNER_SETTINGS_QUERY_KEY });
      queryClient.invalidateQueries({
        queryKey: ["ucat", "study-planner", "projection"],
      });
    },
  });
}
