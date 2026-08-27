"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DASHBOARD_STUDY_PLAN_QUERY_KEY,
  STUDY_PLAN_QUERY_KEY,
} from "@/features/study-plan/hooks/use-study-plan";
import type { StudyPlanResponse } from "@/features/study-plan/model/types";

const VISIT_SESSION_KEY = "altitutor:ucat-authenticated-visit:v1";

export function UcatAuthenticatedVisit() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (window.sessionStorage.getItem(VISIT_SESSION_KEY)) return;
    window.sessionStorage.setItem(VISIT_SESSION_KEY, "pending");

    void fetch("/api/ucat/authenticated-visit", {
      method: "POST",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Authenticated visit was not recorded.");
        return response.json() as Promise<{ refreshPending: boolean }>;
      })
      .then(({ refreshPending }) => {
        window.sessionStorage.setItem(VISIT_SESSION_KEY, "recorded");
        if (!refreshPending) return;
        const markPending = (data: StudyPlanResponse | undefined) =>
          data ? { ...data, refreshPending: true } : data;
        queryClient.setQueryData(STUDY_PLAN_QUERY_KEY, markPending);
        queryClient.setQueryData(DASHBOARD_STUDY_PLAN_QUERY_KEY, markPending);
        void queryClient.invalidateQueries({ queryKey: STUDY_PLAN_QUERY_KEY });
      })
      .catch(() => {
        window.sessionStorage.removeItem(VISIT_SESSION_KEY);
      });
  }, [queryClient]);

  return null;
}
