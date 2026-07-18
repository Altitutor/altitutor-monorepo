import {
  findNewlyCompletedTask,
  findNextStudyDate,
  getTodayStudyPlanProgress,
  isCarryOverStudyPlanTask,
  mapStudyPlanTaskStatuses,
  selectCurrentStudyPlanTasks,
  selectNextStudyPlanTask,
} from "@/features/study-plan/lib/companion";
import type { StudyPlanTask } from "@/features/study-plan/model/types";

function task(overrides: Partial<StudyPlanTask> = {}): StudyPlanTask {
  return {
    id: overrides.id ?? "task-1",
    scheduledDate: overrides.scheduledDate ?? "2026-07-15",
    sortOrder: overrides.sortOrder ?? 0,
    taskType: overrides.taskType ?? "practice",
    title: overrides.title ?? "Practice",
    description: "",
    rationale: "",
    estimatedMinutes: 10,
    targetUnits: 10,
    sectionId: null,
    questionStemCategoryId: null,
    questionTagId: null,
    learningModuleId: null,
    questionSetId: null,
    mockId: null,
    skillTrainerId: null,
    launchPath: "/practice",
    launchConfig: overrides.launchConfig ?? {},
    status: overrides.status ?? "planned",
    completedUnits: overrides.completedUnits ?? 0,
    startedAt: null,
    completedAt: overrides.completedAt ?? null,
    skippedAt: null,
    matchedActivityType: null,
    matchedActivityId: null,
    ...overrides,
    sourceTaskId: overrides.sourceTaskId ?? null,
  };
}

describe("Study plan companion selectors", () => {
  it("puts unfinished earlier work before today's tasks", () => {
    const earlier = task({
      id: "earlier",
      scheduledDate: "2026-07-14",
      sortOrder: 3,
    });
    const today = task({ id: "today" });
    const completedEarlier = task({
      id: "completed-earlier",
      scheduledDate: "2026-07-13",
      status: "completed",
    });

    const current = selectCurrentStudyPlanTasks(
      [today, completedEarlier, earlier],
      "2026-07-15",
    );

    expect(current.map((entry) => entry.id)).toEqual(["earlier", "today"]);
    expect(isCarryOverStudyPlanTask(earlier, "2026-07-15")).toBe(true);
    expect(selectNextStudyPlanTask(current)?.id).toBe("earlier");
  });

  it("continues an active task before starting another planned task", () => {
    const planned = task({ id: "planned", sortOrder: 0 });
    const partial = task({ id: "partial", sortOrder: 2, status: "partial" });
    expect(selectNextStudyPlanTask([planned, partial])?.id).toBe("partial");
  });

  it("does not offer a review until its source attempt exists", () => {
    const awaitingReview = task({
      id: "review",
      taskType: "review",
      launchConfig: { awaitingAttempt: true },
    });
    const next = task({ id: "next", sortOrder: 1 });
    expect(selectNextStudyPlanTask([awaitingReview, next])?.id).toBe("next");
  });

  it("counts completion without treating skipped work as required", () => {
    expect(
      getTodayStudyPlanProgress([
        task({ id: "done", status: "completed" }),
        task({ id: "remaining", sortOrder: 1 }),
        task({ id: "skipped", sortOrder: 2, status: "skipped" }),
      ]),
    ).toEqual({ completed: 1, total: 2, percent: 50 });
  });

  it("finds the next future study day", () => {
    expect(
      findNextStudyDate(
        [
          task({ id: "today", scheduledDate: "2026-07-15" }),
          task({ id: "later", scheduledDate: "2026-07-18" }),
          task({
            id: "tomorrow-skipped",
            scheduledDate: "2026-07-16",
            status: "skipped",
          }),
        ],
        "2026-07-15",
      ),
    ).toBe("2026-07-18");
  });

  it("celebrates only a real transition for an existing task", () => {
    const before = [task({ id: "existing", status: "in_progress" })];
    const after = [
      task({
        id: "existing",
        status: "completed",
        completedAt: "2026-07-15T10:00:00Z",
      }),
      task({
        id: "new",
        status: "completed",
        completedAt: "2026-07-15T10:01:00Z",
      }),
    ];
    expect(
      findNewlyCompletedTask(mapStudyPlanTaskStatuses(before), after)?.id,
    ).toBe("existing");
  });
});
