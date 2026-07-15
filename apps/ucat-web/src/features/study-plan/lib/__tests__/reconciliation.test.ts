import {
  matchLearningModuleProgress,
  matchPracticeSession,
  shouldReconcileStudyPlanTask,
} from "@/features/study-plan/lib/reconciliation";

describe("Study plan reconciliation", () => {
  it("reconciles work that a student explicitly starts before its scheduled date", () => {
    expect(shouldReconcileStudyPlanTask({
      scheduledDate: "2026-07-16",
      status: "in_progress",
      taskType: "practice",
    }, "2026-07-14")).toBe(true);
  });

  it("does not consume untouched future repeatable tasks", () => {
    expect(shouldReconcileStudyPlanTask({
      scheduledDate: "2026-08-16",
      status: "planned",
      taskType: "practice",
    }, "2026-07-14")).toBe(false);
  });

  it("reconciles uniquely identifiable learning modules even when completed early", () => {
    expect(shouldReconcileStudyPlanTask({
      scheduledDate: "2026-08-16",
      status: "planned",
      taskType: "learn",
    }, "2026-07-14")).toBe(true);
  });

  it("treats 100 percent progress as complete even without a completed timestamp", () => {
    expect(matchLearningModuleProgress({
      completionPercent: 100,
      completedAt: null,
    }, "2026-07-14T12:00:00.000Z")).toEqual({
      status: "completed",
      completedAt: "2026-07-14T12:00:00.000Z",
      completedUnits: 100,
    });
  });

  it("only completes category practice with a matching category and broadly matching volume", () => {
    const task = {
      sectionId: "dm",
      questionStemCategoryId: "syllogisms",
      targetUnits: 10,
    };
    expect(matchPracticeSession(task, {
      sectionId: "dm",
      questionCount: 9,
      completedAt: "2026-07-14T12:00:00.000Z",
      filtersSnapshot: { categoryIds: ["syllogisms"] },
    })).toEqual({ status: "completed", completedUnits: 9 });
    expect(matchPracticeSession(task, {
      sectionId: "dm",
      questionCount: 10,
      completedAt: "2026-07-14T12:00:00.000Z",
      filtersSnapshot: { categoryIds: ["logical-puzzles"] },
    })).toBeNull();
  });

  it("keeps an undersized matching practice session partial", () => {
    expect(matchPracticeSession({
      sectionId: "vr",
      questionStemCategoryId: "reading",
      targetUnits: 10,
    }, {
      sectionId: "vr",
      questionCount: 8,
      completedAt: "2026-07-14T12:00:00.000Z",
      filtersSnapshot: { categoryIds: ["reading"] },
    })).toEqual({ status: "partial", completedUnits: 8 });
  });
});
