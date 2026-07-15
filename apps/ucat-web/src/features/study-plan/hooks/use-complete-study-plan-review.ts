"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { updateStudyPlanTask } from "@/features/study-plan/api/study-plan";

/** Opening the linked result is the completion event for a Study plan review. */
export function useCompleteStudyPlanReview(ready: boolean) {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const sentTaskId = useRef<string | null>(null);
  const taskId = searchParams.get("studyPlanReviewTaskId");

  useEffect(() => {
    if (!ready || !taskId || sentTaskId.current === taskId) return;
    sentTaskId.current = taskId;
    void updateStudyPlanTask(taskId, "complete")
      .then(() => queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] }))
      .catch(() => {
        sentTaskId.current = null;
      });
  }, [queryClient, ready, taskId]);
}
