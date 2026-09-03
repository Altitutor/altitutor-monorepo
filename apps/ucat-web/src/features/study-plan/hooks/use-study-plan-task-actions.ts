"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useQuotaLimitDialog } from "@/features/ucat-access/context/upsell-dialog-context";
import { createAndPersistPracticeSession } from "@/features/practice/api/create-practice-session";
import type { PracticeSelectionInput } from "@/features/practice/model/types";
import { updateStudyPlanTask } from "@/features/study-plan/api/study-plan";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import {
  selectRecommendedTaskBeforeStart,
  shouldConfirmStudyPlanTaskOrder,
} from "@/features/study-plan/lib/companion";
import type {
  StudyPlanResponse,
  StudyPlanTask,
} from "@/features/study-plan/model/types";
import { QuotaExceededError } from "@/lib/ucat/quota/parse-quota-error";

type PendingAction = "start" | "skip" | "unskip" | null;

function practiceStartInput(task: StudyPlanTask) {
  const config = task.launchConfig;
  if (config.kind !== "practice" || typeof config.ucatSectionId !== "string")
    return null;
  const section = config.section;
  if (
    section !== "verbal_reasoning" &&
    section !== "decision_making" &&
    section !== "quantitative_reasoning" &&
    section !== "situational_judgement"
  )
    return null;
  const payload: PracticeSelectionInput & {
    reviewTiming: "afterEachStem" | "atEnd";
  } = {
    section,
    unansweredOnly: false,
    incorrectOnly: false,
    categoryIds: Array.isArray(config.categoryIds)
      ? config.categoryIds.filter((id): id is string => typeof id === "string")
      : [],
    questionTagIds: Array.isArray(config.questionTagIds)
      ? config.questionTagIds.filter(
          (id): id is string => typeof id === "string",
        )
      : [],
    linkedLearningPractice: config.linkedLearningPractice === true,
    timeMode: config.timeMode === "off" ? "off" : "speed",
    timeSpeedMultiplier:
      typeof config.timeSpeedMultiplier === "number"
        ? config.timeSpeedMultiplier
        : 1,
    customTimeMinutes: null,
    questionCount:
      typeof config.questionCount === "number" ? config.questionCount : 10,
    timePerQuestionSeconds:
      typeof config.timePerQuestionSeconds === "number"
        ? config.timePerQuestionSeconds
        : null,
    reviewTiming:
      config.reviewTiming === "afterEachStem" ? "afterEachStem" : "atEnd",
  };
  return {
    payload,
    ucatSectionId: config.ucatSectionId,
    studyPlan: {
      taskId: task.id,
      title: task.title,
      targetUnits: task.targetUnits,
    },
  };
}

export function useStudyPlanTaskActions(
  task: StudyPlanTask | null,
  enabled = true,
  planOverride?: StudyPlanResponse | null,
) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openQuotaLimit } = useQuotaLimitDialog();
  const planQuery = useStudyPlan(enabled && planOverride === undefined);
  const plan = planOverride === undefined ? planQuery.data : planOverride;
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [orderPromptOpen, setOrderPromptOpen] = useState(false);

  const currentRecommendedTask = plan && task
    ? selectRecommendedTaskBeforeStart(plan.tasks, plan.today, task)
    : null;

  async function executeTask(taskToStart: StudyPlanTask) {
    if (!enabled) return;
    setPendingAction("start");
    setError(null);
    try {
      const practiceInput = practiceStartInput(taskToStart);
      if (practiceInput) {
        await createAndPersistPracticeSession(practiceInput);
        await updateStudyPlanTask(taskToStart.id, "start");
        await queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] });
        setPendingAction(null);
        router.push("/exam");
        return;
      }
      await updateStudyPlanTask(taskToStart.id, "start");
      await queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] });
      const skillTrainerKey = taskToStart.launchConfig.skillTrainerKey;
      const launchPath =
        taskToStart.taskType === "skill_trainer" &&
        typeof skillTrainerKey === "string"
          ? `/skill-trainer/${skillTrainerKey.replaceAll("_", "-")}/play`
          : taskToStart.taskType === "review"
            ? `${taskToStart.launchPath}${taskToStart.launchPath.includes("?") ? "&" : "?"}studyPlanReviewTaskId=${encodeURIComponent(taskToStart.id)}`
            : taskToStart.taskType === "learn" ||
                taskToStart.taskType === "section_benchmark"
              ? `${taskToStart.launchPath}${taskToStart.launchPath.includes("?") ? "&" : "?"}studyPlanTaskId=${encodeURIComponent(taskToStart.id)}`
              : taskToStart.launchPath;
      setPendingAction(null);
      router.push(launchPath);
    } catch (caught) {
      if (caught instanceof QuotaExceededError) {
        openQuotaLimit(caught.payload, {
          dismissAction: {
            href: "/study-plan",
            label: "Back to Study plan",
          },
        });
        setPendingAction(null);
        return;
      }
      setError(
        caught instanceof Error ? caught.message : "Could not start this task.",
      );
      setPendingAction(null);
    }
  }

  async function startTask() {
    if (!task) return;
    if (shouldConfirmStudyPlanTaskOrder(task, currentRecommendedTask)) {
      setOrderPromptOpen(true);
      return;
    }
    await executeTask(task);
  }

  async function continueOutOfOrderTask() {
    if (!task) return;
    setOrderPromptOpen(false);
    await executeTask(task);
  }

  async function startCurrentRecommendedTask() {
    if (!currentRecommendedTask) return;
    setOrderPromptOpen(false);
    await executeTask(currentRecommendedTask);
  }

  async function skipTask() {
    if (!task || !enabled) return;
    setPendingAction("skip");
    setError(null);
    try {
      await updateStudyPlanTask(task.id, "skip");
      await queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not skip this task.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function unskipTask() {
    if (!task || !enabled) return;
    setPendingAction("unskip");
    setError(null);
    try {
      await updateStudyPlanTask(task.id, "unskip");
      await queryClient.invalidateQueries({ queryKey: ["ucat-study-plan"] });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not undo this skip.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  return {
    error,
    pendingAction,
    orderPromptOpen,
    currentRecommendedTask,
    setOrderPromptOpen,
    continueOutOfOrderTask,
    startCurrentRecommendedTask,
    startTask,
    skipTask,
    unskipTask,
  };
}
