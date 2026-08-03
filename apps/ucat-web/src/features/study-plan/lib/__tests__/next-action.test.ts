import {
  describeStudyNextAction,
  findPrioritySession,
  resolveStudyNextAction,
} from "@/features/study-plan/lib/next-action";
import type { StudentUcatSession } from "@/features/sessions/api/sessions-api";
import type {
  StudyGuidanceItem,
  StudyPlanResponse,
  StudyPlanTask,
} from "@/features/study-plan/model/types";

function task(overrides: Partial<StudyPlanTask> = {}): StudyPlanTask {
  return {
    id: overrides.id ?? "task-1",
    scheduledDate: overrides.scheduledDate ?? "2026-07-15",
    sortOrder: overrides.sortOrder ?? 0,
    taskType: overrides.taskType ?? "practice",
    title: overrides.title ?? "Practice",
    description: overrides.description ?? "Complete focused practice.",
    rationale: overrides.rationale ?? "This is the most useful next step.",
    estimatedMinutes: overrides.estimatedMinutes ?? 20,
    targetUnits: overrides.targetUnits ?? 10,
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

function plan(tasks: StudyPlanTask[]): StudyPlanResponse {
  return {
    profile: {
      id: "profile-1",
      studyPlanEnabled: true,
      targetScore: 2100,
      testYear: 2026,
      testDate: "2026-09-15",
      planningDate: "2026-09-15",
      planningDateIsProvisional: false,
      nextWeeklyReplanOn: null,
      preferredMockWeekday: 6,
      availableDays: [{ weekday: 3, maxMinutes: 45 }],
    },
    generation: null,
    tasks,
    nextSteps: [],
    today: "2026-07-15",
    todayTasks: tasks.filter((entry) => entry.scheduledDate === "2026-07-15"),
    completion: { completed: 0, scheduledThroughToday: 0, percent: 0 },
  };
}

function guidanceItem(
  overrides: Partial<StudyGuidanceItem> = {},
): StudyGuidanceItem {
  return {
    id: overrides.id ?? "guidance-1",
    position: overrides.position ?? 1,
    triggerKey: overrides.triggerKey ?? "daily:2026-07-15",
    generatedOn: overrides.generatedOn ?? "2026-07-15",
    taskType: overrides.taskType ?? "practice",
    title: overrides.title ?? "Practice Verbal Reasoning",
    description: overrides.description ?? "Complete focused practice.",
    rationale: overrides.rationale ?? "This is the most useful next step.",
    estimatedMinutes: overrides.estimatedMinutes ?? 20,
    sectionId: null,
    questionStemCategoryId: null,
    learningModuleId: null,
    questionSetId: null,
    mockId: null,
    skillTrainerId: null,
    sourceAttemptType: null,
    sourceAttemptId: null,
    launchPath: "/practice",
    launchConfig: {},
    ...overrides,
  };
}

function planWithoutStudyPlan(
  nextSteps: StudyGuidanceItem[] = [guidanceItem()],
): StudyPlanResponse {
  return {
    profile: {
      id: "profile-1",
      studyPlanEnabled: false,
      targetScore: 2100,
      testYear: 2026,
      testDate: "2026-09-15",
      planningDate: "2026-09-15",
      planningDateIsProvisional: false,
      nextWeeklyReplanOn: null,
      preferredMockWeekday: 6,
      availableDays: [],
    },
    generation: null,
    tasks: [],
    nextSteps,
    today: "2026-07-15",
    todayTasks: [],
    completion: { completed: 0, scheduledThroughToday: 0, percent: 0 },
  };
}

function session(
  startAt: string,
  endAt: string,
  id = "session-1",
): StudentUcatSession {
  return {
    session_id: id,
    class_id: "class-1",
    subject_name: "UCAT",
    start_at: startAt,
    end_at: endAt,
  } as StudentUcatSession;
}

describe("study next action", () => {
  const now = new Date("2026-07-15T03:00:00.000Z");

  it("puts a live session ahead of the Study plan task", () => {
    const result = resolveStudyNextAction({
      now,
      sessions: [
        session("2026-07-15T02:30:00.000Z", "2026-07-15T04:00:00.000Z"),
      ],
      plan: plan([task()]),
      planLoadFailed: false,
      studyPlanDecided: true,
      hasGoal: true,
    });
    expect(result.kind).toBe("session");
    expect(result.kind === "session" && result.live).toBe(true);
  });

  it("promotes an imminent session but leaves a later session in context", () => {
    expect(
      findPrioritySession(
        [session("2026-07-15T04:00:00.000Z", "2026-07-15T05:00:00.000Z")],
        now,
      ),
    ).not.toBeNull();
    expect(
      findPrioritySession(
        [session("2026-07-15T08:00:00.000Z", "2026-07-15T09:00:00.000Z")],
        now,
      ),
    ).toBeNull();
  });

  it("turns an actionable review task into the next action", () => {
    const review = task({
      taskType: "review",
      launchConfig: { awaitingAttempt: false },
    });
    const result = resolveStudyNextAction({
      now,
      sessions: [],
      plan: plan([review]),
      planLoadFailed: false,
      studyPlanDecided: true,
      hasGoal: true,
    });
    expect(result.kind).toBe("task");
    expect(result.kind === "task" && result.task.taskType).toBe("review");
    expect(result.kind === "task" && result.fromEarlierStudyDay).toBe(false);
  });

  it("puts unfinished earlier work ahead of today's task", () => {
    const result = resolveStudyNextAction({
      now,
      sessions: [],
      plan: plan([
        task({ id: "today" }),
        task({ id: "earlier", scheduledDate: "2026-07-14" }),
      ]),
      planLoadFailed: false,
      studyPlanDecided: true,
      hasGoal: true,
    });

    expect(result.kind).toBe("task");
    expect(result.kind === "task" && result.task.id).toBe("earlier");
    expect(result.kind === "task" && result.fromEarlierStudyDay).toBe(true);
  });

  it("prompts for Study plan setup before goal when the student has not decided", () => {
    const result = resolveStudyNextAction({
      now,
      sessions: [],
      plan: null,
      planLoadFailed: false,
      studyPlanDecided: false,
      hasGoal: false,
    });
    expect(result).toEqual({ kind: "plan_setup" });
  });

  it("prompts for goal setup after Study plan is declined without a saved goal", () => {
    const result = resolveStudyNextAction({
      now,
      sessions: [],
      plan: null,
      planLoadFailed: false,
      studyPlanDecided: true,
      hasGoal: false,
    });
    expect(result).toEqual({ kind: "goal_setup" });
  });

  it("shows guidance when Study plan is off and a goal exists", () => {
    const primary = guidanceItem({ id: "primary" });
    const result = resolveStudyNextAction({
      now,
      sessions: [],
      plan: planWithoutStudyPlan([primary]),
      planLoadFailed: false,
      studyPlanDecided: true,
      hasGoal: true,
    });
    expect(result).toEqual({
      kind: "guidance",
      primary,
      secondary: null,
    });
  });

  it("celebrates completed work and identifies the next study day", () => {
    const result = resolveStudyNextAction({
      now,
      sessions: [],
      plan: plan([
        task({ status: "completed" }),
        task({ id: "later", scheduledDate: "2026-07-18" }),
      ]),
      planLoadFailed: false,
      studyPlanDecided: true,
      hasGoal: true,
    });
    expect(result).toEqual({
      kind: "caught_up",
      nextStudyDate: "2026-07-18",
      hadTasksToday: true,
    });
  });

  it("describes plan setup with a direct setup CTA", () => {
    const content = describeStudyNextAction({ kind: "plan_setup" });
    expect(content.primaryLabel).toBe("Set up Study plan");
    expect(content.primaryHref).toBe("/study-plan/setup?section=plan");
  });
});
