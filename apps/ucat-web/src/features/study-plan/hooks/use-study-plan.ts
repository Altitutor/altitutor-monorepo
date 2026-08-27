"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchDashboardStudyPlan,
  fetchStudyPlan,
} from "@/features/study-plan/api/study-plan";

export const STUDY_PLAN_QUERY_KEY = ["ucat-study-plan"] as const;
export const DASHBOARD_STUDY_PLAN_QUERY_KEY = [
  ...STUDY_PLAN_QUERY_KEY,
  "dashboard",
] as const;

export function useStudyPlan(enabled = true) {
  return useQuery({
    queryKey: STUDY_PLAN_QUERY_KEY,
    queryFn: fetchStudyPlan,
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: (query) =>
      query.state.data?.refreshPending ? 5 * 1000 : false,
    enabled,
  });
}

export function useDashboardStudyPlan(enabled = true) {
  return useQuery({
    queryKey: DASHBOARD_STUDY_PLAN_QUERY_KEY,
    queryFn: fetchDashboardStudyPlan,
    staleTime: 60 * 1000,
    refetchInterval: (query) =>
      query.state.data?.refreshPending ? 5 * 1000 : false,
    enabled,
  });
}
