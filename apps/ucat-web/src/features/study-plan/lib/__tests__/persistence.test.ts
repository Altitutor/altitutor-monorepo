import { prepareStudyPlanTasks } from "@/features/study-plan/lib/persistence";
import type { GeneratedStudyPlanTask } from "@/features/study-plan/model/types";

function task(
  overrides: Partial<GeneratedStudyPlanTask>,
): GeneratedStudyPlanTask {
  return {
    scheduledDate: "2026-07-19",
    sortOrder: 0,
    taskType: "practice",
    title: "Syllogisms",
    description: "Practice",
    rationale: "Improve",
    estimatedMinutes: 10,
    targetUnits: 10,
    sectionId: "dm",
    questionStemCategoryId: "syllogisms",
    questionTagId: null,
    learningModuleId: null,
    questionSetId: null,
    mockId: null,
    skillTrainerId: null,
    launchPath: "/practice",
    launchConfig: {},
    ...overrides,
  };
}

describe("Study plan persistence", () => {
  it("resolves a generated review to the durable id of its source task", () => {
    let id = 0;
    const prepared = prepareStudyPlanTasks(
      [
        task({}),
        task({
          scheduledDate: "2026-07-20",
          taskType: "review",
          title: "Review · Syllogisms",
          sourceTaskRef: { scheduledDate: "2026-07-19", sortOrder: 0 },
        }),
      ],
      null,
      () => `task-${++id}`,
    );

    expect(prepared[1]).toMatchObject({
      id: "task-2",
      sourceTaskId: "task-1",
    });
  });

  it("drops a regenerated future review when its source is preserved instead", () => {
    let id = 0;
    const prepared = prepareStudyPlanTasks(
      [
        task({ scheduledDate: "2026-07-19" }),
        task({
          scheduledDate: "2026-07-20",
          taskType: "review",
          title: "Review · Syllogisms",
          sourceTaskRef: { scheduledDate: "2026-07-19", sortOrder: 0 },
        }),
        task({
          scheduledDate: "2026-07-20",
          sortOrder: 1,
          title: "Logical puzzles",
        }),
      ],
      "2026-07-19",
      () => `task-${++id}`,
    );

    expect(prepared).toHaveLength(1);
    expect(prepared[0]).toMatchObject({
      id: "task-1",
      title: "Logical puzzles",
      sourceTaskId: null,
    });
  });

  it("rejects a review whose source is absent from the persisted graph", () => {
    expect(() =>
      prepareStudyPlanTasks(
        [
          task({
            taskType: "review",
            title: "Review · Missing",
            sourceTaskRef: { scheduledDate: "2026-07-18", sortOrder: 0 },
          }),
        ],
        null,
        () => "review-id",
      ),
    ).toThrow('Review task "Review · Missing" has no persisted source task.');
  });
});
