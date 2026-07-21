"use client";

import { useEffect } from "react";
import { useUcatProfile } from "@/features/layout/hooks/use-ucat-profile";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";
import { useProgressAttempts } from "@/features/progress/hooks/use-progress-attempts";
import { useScoreProjection } from "@/features/score-projection/hooks/use-score-projection";
import { useStudentUcatSessions } from "@/features/sessions/hooks/use-sessions";
import {
  useDashboardStudyPlan,
  useStudyPlan,
} from "@/features/study-plan/hooks/use-study-plan";
import { usePracticeDiscountDashboard } from "@/features/subscription/hooks/use-practice-discount-dashboard";

type DashboardDataPreloaderProps = {
  onSettled: () => void;
};

/** Warms every query responsible for the dashboard's initial card skeletons. */
export function DashboardDataPreloader({
  onSettled,
}: DashboardDataPreloaderProps) {
  const profile = useUcatProfile();
  const plan = useStudyPlan();
  const dashboardPlan = useDashboardStudyPlan();
  const projection = useScoreProjection(Boolean(dashboardPlan.data?.profile));
  const sessions = useStudentUcatSessions();
  const onboarding = useOnboardingProgress();
  const discount = usePracticeDiscountDashboard();
  const checklistAttempts = useProgressAttempts({
    source: "all",
    page: 1,
    pageSize: 1,
    dateRange: "all",
  });
  const recentAttempts = useProgressAttempts({
    source: "all",
    page: 1,
    pageSize: 4,
    dateRange: "all",
    completedOnly: true,
  });

  const settled =
    !profile.isLoading &&
    !plan.isLoading &&
    !dashboardPlan.isLoading &&
    !sessions.isLoading &&
    !onboarding.isLoading &&
    !discount.isLoading &&
    !checklistAttempts.isLoading &&
    !recentAttempts.isLoading &&
    (!dashboardPlan.data?.profile || !projection.isLoading);

  useEffect(() => {
    if (settled) onSettled();
  }, [onSettled, settled]);

  return null;
}
