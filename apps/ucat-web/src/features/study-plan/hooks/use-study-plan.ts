"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchStudyPlan } from "@/features/study-plan/api/study-plan";

export function useStudyPlan() {
  return useQuery({
    queryKey: ["ucat-study-plan"],
    queryFn: fetchStudyPlan,
    staleTime: 0,
    refetchOnMount: "always",
  });
}
