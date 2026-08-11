import type { GeneratedStudyPlanTask } from "@/features/study-plan/model/types";
import type { PreparationVersions } from "@/features/preparation/model/types";

export function needsPreparationVersionReplacement(
  inputSnapshot: unknown,
  current: PreparationVersions,
): boolean {
  if (!inputSnapshot || typeof inputSnapshot !== "object" || Array.isArray(inputSnapshot)) {
    return true;
  }
  const versions = (inputSnapshot as Record<string, unknown>).versions;
  if (!versions || typeof versions !== "object" || Array.isArray(versions)) {
    return true;
  }
  const record = versions as Record<string, unknown>;
  return (
    record.engine !== current.engine ||
    record.policy !== current.policy ||
    record.scoreModel !== current.scoreModel
  );
}

export function planProfileTransition(input: {
  wasEnabled: boolean;
  willBeEnabled: boolean;
}): {
  clearGuidance: boolean;
  generateFreshPlan: boolean;
  retireFuturePlan: boolean;
} {
  return input.willBeEnabled
    ? {
        clearGuidance: true,
        generateFreshPlan: true,
        retireFuturePlan: false,
      }
    : {
        clearGuidance: false,
        generateFreshPlan: false,
        retireFuturePlan: input.wasEnabled,
      };
}

export type PreparedStudyPlanTask = GeneratedStudyPlanTask & {
  id: string;
  sourceTaskId: string | null;
};

function taskRefKey(scheduledDate: string, sortOrder: number): string {
  return `${scheduledDate}:${sortOrder}`;
}

/**
 * Assign durable ids to a generated task graph before it reaches Postgres.
 * During a replan, generated work inside the preservation boundary is omitted,
 * along with reviews that depend on that omitted work.
 */
export function prepareStudyPlanTasks(
  tasks: GeneratedStudyPlanTask[],
  preserveThrough: string | null,
  createId: () => string,
): PreparedStudyPlanTask[] {
  const eligible = tasks.filter((task) => {
    if (!preserveThrough) return true;
    if (task.scheduledDate <= preserveThrough) return false;
    return (
      !task.sourceTaskRef || task.sourceTaskRef.scheduledDate > preserveThrough
    );
  });
  const prepared = eligible.map((task) => ({ ...task, id: createId() }));
  const idsByRef = new Map(
    prepared.map((task) => [
      taskRefKey(task.scheduledDate, task.sortOrder),
      task.id,
    ]),
  );

  return prepared.map((task) => {
    const sourceTaskId = task.sourceTaskRef
      ? (idsByRef.get(
          taskRefKey(
            task.sourceTaskRef.scheduledDate,
            task.sourceTaskRef.sortOrder,
          ),
        ) ?? null)
      : null;
    if (task.taskType === "review" && !sourceTaskId) {
      throw new Error(
        `Review task "${task.title}" has no persisted source task.`,
      );
    }
    return { ...task, sourceTaskId };
  });
}
