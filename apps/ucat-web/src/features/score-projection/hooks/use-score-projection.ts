import { useQuery } from "@tanstack/react-query";
import { getScoreProjection } from "@/features/score-projection/api/score-projection";

export const SCORE_PROJECTION_QUERY_KEY = ["ucat", "score-projection"] as const;

export function useScoreProjection(enabled = true) {
  return useQuery({
    queryKey: SCORE_PROJECTION_QUERY_KEY,
    queryFn: getScoreProjection,
    enabled,
  });
}
