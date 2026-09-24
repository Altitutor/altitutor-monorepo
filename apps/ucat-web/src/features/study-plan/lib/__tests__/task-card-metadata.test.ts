import { visibleTaskPace } from "@/features/study-plan/lib/task-card-metadata";
import type { StudyPlanTask } from "@/features/study-plan/model/types";

function task(
  taskType: StudyPlanTask["taskType"],
  launchConfig: StudyPlanTask["launchConfig"],
): StudyPlanTask {
  return {
    id: "task-1",
    scheduledDate: "2026-08-13",
    sortOrder: 0,
    taskType,
    status: "planned",
    title: "Task",
    description: "Task description",
    rationale: "Task reason",
    estimatedMinutes: 20,
    targetUnits: null,
    sectionId: "vr",
    questionStemCategoryId: null,
    questionTagId: null,
    learningModuleId: null,
    questionSetId: null,
    mockId: null,
    skillTrainerId: null,
    launchPath: "/practice",
    launchConfig,
    sourceTaskId: null,
    completedUnits: 0,
    startedAt: null,
    completedAt: null,
    skippedAt: null,
    matchedActivityType: null,
    matchedActivityId: null,
  };
}

describe("visibleTaskPace", () => {
  it("hides an internal prescribed pace for lessons, untimed practice, and review", () => {
    const metadata = { prescribedPace: 0.8, timeMode: "off" };

    expect(visibleTaskPace(task("learn", metadata))).toBeNull();
    expect(visibleTaskPace(task("practice", metadata))).toBeNull();
    expect(visibleTaskPace(task("review", metadata))).toBeNull();
  });

  it("shows pace only when the student will actually launch timed work", () => {
    expect(
      visibleTaskPace(
        task("practice", { prescribedPace: 0.8, timeMode: "speed" }),
      ),
    ).toBe(0.8);
  });
});
