"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { updateStudyPlanTask } from "@/features/study-plan/api/study-plan";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";

function attemptIdFromPath(pathname: string): string | null {
  const match = pathname.match(
    /\/(?:practice-sessions|set-attempts|mock-attempts)\/([^/]+)\/?$/,
  );
  return match?.[1] ?? null;
}

/** Complete the linked Study plan task once durable attempt review is finished. */
export function useCompleteStudyPlanReview(ready: boolean) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const planQuery = useStudyPlan(ready);
  const sentTaskId = useRef<string | null>(null);
  const taskIdFromQuery = searchParams.get("studyPlanReviewTaskId");
  const attemptId = attemptIdFromPath(pathname);
  const taskIdFromPlan =
    !taskIdFromQuery && attemptId && planQuery.data
      ? (planQuery.data.tasks.find(
          (task) =>
            task.taskType === "review" &&
            task.status !== "completed" &&
            task.status !== "skipped" &&
            (task.matchedActivityId === attemptId ||
              task.launchPath.includes(attemptId)),
        )?.id ?? null)
      : null;
  const taskId = taskIdFromQuery ?? taskIdFromPlan;

  useEffect(() => {
    if (!ready || !taskId || sentTaskId.current === taskId) return;
    sentTaskId.current = taskId;
    void updateStudyPlanTask(taskId, "complete")
      .then(() =>
        queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] }),
      )
      .catch(() => {
        sentTaskId.current = null;
      });
  }, [queryClient, ready, taskId]);
}
