import {
  matchLearningModuleProgress,
  matchPracticeSession,
  selectLearningTaskOwner,
  shouldReconcileStudyPlanTask,
} from "@/features/study-plan/lib/reconciliation";

describe("Study plan reconciliation", () => {
  it("reconciles work that a student explicitly starts before its scheduled date", () => {
    expect(
      shouldReconcileStudyPlanTask(
        {
          canCompleteBeforeScheduledDate: false,
          scheduledDate: "2026-07-16",
          status: "in_progress",
          taskType: "practice",
        },
        "2026-07-14",
      ),
    ).toBe(true);
  });

  it("does not consume untouched future repeatable tasks", () => {
    expect(
      shouldReconcileStudyPlanTask(
        {
          canCompleteBeforeScheduledDate: false,
          scheduledDate: "2026-08-16",
          status: "planned",
          taskType: "practice",
        },
        "2026-07-14",
      ),
    ).toBe(false);
  });

  it("does not poll every untouched future learning task during ordinary reads", () => {
    expect(
      shouldReconcileStudyPlanTask(
        {
          canCompleteBeforeScheduledDate: false,
          scheduledDate: "2026-08-16",
          status: "planned",
          taskType: "learn",
        },
        "2026-07-14",
      ),
    ).toBe(false);
  });

  it.each(["section_benchmark", "mock"] as const)(
    "reconciles a future %s completed independently",
    (taskType) => {
      expect(
        shouldReconcileStudyPlanTask(
          {
            canCompleteBeforeScheduledDate: true,
            scheduledDate: "2026-08-16",
            status: "planned",
            taskType,
          },
          "2026-07-14",
        ),
      ).toBe(true);
    },
  );

  it("assigns learning progress only to its explicit Study-plan task", () => {
    const tasks = [
      {
        id: "earlier-copy",
        learningModuleId: "module-1",
        scheduledDate: "2026-07-14",
        startedAt: null,
        status: "planned" as const,
      },
      {
        id: "launched-copy",
        learningModuleId: "module-1",
        scheduledDate: "2026-07-21",
        startedAt: "2026-07-13T10:00:00.000Z",
        status: "in_progress" as const,
      },
    ];

    expect(
      selectLearningTaskOwner(tasks, "module-1", "launched-copy")?.id,
    ).toBe("launched-copy");
  });

  it("assigns independent learning to at most the earliest active copy", () => {
    const tasks = [
      {
        id: "later-copy",
        learningModuleId: "module-1",
        scheduledDate: "2026-07-21",
        startedAt: null,
        status: "planned" as const,
      },
      {
        id: "earlier-copy",
        learningModuleId: "module-1",
        scheduledDate: "2026-07-14",
        startedAt: null,
        status: "planned" as const,
      },
    ];

    expect(selectLearningTaskOwner(tasks, "module-1", null)?.id).toBe(
      "earlier-copy",
    );
  });

  it("never transfers explicit progress to a replacement-generation copy", () => {
    const tasks = [
      {
        id: "replacement-copy",
        learningModuleId: "module-1",
        scheduledDate: "2026-07-21",
        startedAt: null,
        status: "planned" as const,
      },
    ];

    expect(
      selectLearningTaskOwner(tasks, "module-1", "superseded-owner"),
    ).toBeNull();
  });

  it("treats 100 percent progress as complete even without a completed timestamp", () => {
    expect(
      matchLearningModuleProgress(
        {
          completionPercent: 100,
          completedAt: null,
        },
        "2026-07-14T12:00:00.000Z",
      ),
    ).toEqual({
      status: "completed",
      completedAt: "2026-07-14T12:00:00.000Z",
      completedUnits: 100,
    });
  });

  it("only completes category practice with a matching category and broadly matching volume", () => {
    const task = {
      taskId: "practice-task",
      sectionId: "dm",
      questionStemCategoryId: "syllogisms",
      targetUnits: 10,
    };
    expect(
      matchPracticeSession(task, {
        sectionId: "dm",
        questionCount: 9,
        completedAt: "2026-07-14T12:00:00.000Z",
        filtersSnapshot: { categoryIds: ["syllogisms"], questionCount: 10 },
      }),
    ).toEqual({ status: "completed", completedUnits: 9 });
    expect(
      matchPracticeSession(task, {
        sectionId: "dm",
        questionCount: 10,
        completedAt: "2026-07-14T12:00:00.000Z",
        filtersSnapshot: {
          categoryIds: ["logical-puzzles"],
          questionCount: 10,
        },
      }),
    ).toBeNull();
  });

  it("keeps an undersized matching practice session partial", () => {
    expect(
      matchPracticeSession(
        {
          taskId: "practice-task",
          sectionId: "vr",
          questionStemCategoryId: "reading",
          targetUnits: 10,
        },
        {
          sectionId: "vr",
          questionCount: 8,
          completedAt: "2026-07-14T12:00:00.000Z",
          filtersSnapshot: { categoryIds: ["reading"], questionCount: 8 },
        },
      ),
    ).toEqual({ status: "partial", completedUnits: 8 });
  });

  it("completes a directly linked planned session at its delivered whole-stem volume", () => {
    expect(
      matchPracticeSession(
        {
          taskId: "practice-task",
          sectionId: "vr",
          questionStemCategoryId: "reading",
          targetUnits: 5,
        },
        {
          sectionId: "vr",
          questionCount: 4,
          completedAt: "2026-07-14T12:00:00.000Z",
          filtersSnapshot: {
            categoryIds: ["reading"],
            studyPlanTaskId: "practice-task",
          },
        },
      ),
    ).toEqual({ status: "completed", completedUnits: 4 });
  });
});
