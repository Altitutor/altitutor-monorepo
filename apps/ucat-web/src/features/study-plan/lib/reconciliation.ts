import type {
  StudyPlanTaskStatus,
  StudyPlanTaskType,
} from "@/features/study-plan/model/types";

type ReconciliationCandidate = {
  scheduledDate: string;
  status: StudyPlanTaskStatus;
  taskType: StudyPlanTaskType;
};

type LearningModuleProgress = {
  completedAt: string | null;
  completionPercent: number;
};

export type LearningModuleTaskMatch = {
  completedAt: string | null;
  completedUnits: number;
  status: "completed" | "partial";
};

type PracticeTaskRequirement = {
  sectionId: string;
  questionStemCategoryId: string | null;
  targetUnits: number | null;
};

type PracticeSessionCandidate = {
  sectionId: string;
  questionCount: number | null;
  completedAt: string | null;
  filtersSnapshot: unknown;
};

export type PracticeTaskMatch = {
  completedUnits: number;
  status: "completed" | "partial";
};

/**
 * Work that is due, uniquely identifiable learning work, or work the student
 * explicitly started early can reconcile. Untouched future repeatable work is
 * deliberately excluded so one burst of extra practice does not consume weeks
 * of the future plan.
 */
export function shouldReconcileStudyPlanTask(
  task: ReconciliationCandidate,
  today: string,
): boolean {
  if (task.status === "completed" || task.status === "skipped") return false;
  if (task.taskType === "learn") return true;
  if (task.status === "in_progress" || task.status === "partial") return true;
  return task.scheduledDate <= today;
}

/** Keep the Study plan's completion contract aligned with the learning UI. */
export function matchLearningModuleProgress(
  progress: LearningModuleProgress,
  reconciledAt: string,
): LearningModuleTaskMatch | null {
  if (progress.completedAt || progress.completionPercent >= 100) {
    return {
      status: "completed",
      completedAt: progress.completedAt ?? reconciledAt,
      completedUnits: 100,
    };
  }
  if (progress.completionPercent > 0) {
    return {
      status: "partial",
      completedAt: null,
      completedUnits: Math.round(progress.completionPercent),
    };
  }
  return null;
}

function categoryIdsFromFilters(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const categoryIds = (value as Record<string, unknown>).categoryIds;
  return Array.isArray(categoryIds)
    ? categoryIds.filter((id): id is string => typeof id === "string")
    : [];
}

/**
 * A practice task is evidence-specific: the session must match its section and
 * category. At least 85% of the requested volume completes the task; a smaller
 * completed session is retained as partial progress instead of disappearing.
 */
export function matchPracticeSession(
  task: PracticeTaskRequirement,
  session: PracticeSessionCandidate,
): PracticeTaskMatch | null {
  if (!session.completedAt || session.sectionId !== task.sectionId) return null;
  if (
    task.questionStemCategoryId &&
    !categoryIdsFromFilters(session.filtersSnapshot).includes(task.questionStemCategoryId)
  ) return null;

  const completedUnits = Math.max(0, session.questionCount ?? 0);
  if (completedUnits === 0) return null;
  const targetUnits = Math.max(1, task.targetUnits ?? completedUnits);
  return {
    status: completedUnits >= Math.ceil(targetUnits * 0.85) ? "completed" : "partial",
    completedUnits: Math.min(targetUnits, completedUnits),
  };
}
