import { useQuery } from "@tanstack/react-query";
import { getStudyPlannerProjection } from "@/features/study-planner/api/study-planner";

export const STUDY_PLANNER_PROJECTION_QUERY_KEY = [
  "ucat",
  "study-planner",
  "projection",
] as const;

export function useStudyPlannerProjection(enabled = true) {
  return useQuery({
    queryKey: STUDY_PLANNER_PROJECTION_QUERY_KEY,
    queryFn: getStudyPlannerProjection,
    enabled,
  });
}
