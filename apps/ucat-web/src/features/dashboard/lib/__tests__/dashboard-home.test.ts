import {
  dashboardDiscountState,
  findPrioritySession,
  quotaAreaForTask,
  resolveDashboardNextAction,
  selectDashboardQuotaArea,
  summarizeDashboardWeek,
} from "@/features/dashboard/lib/dashboard-home";
import type { PracticeDiscountDashboardStatus } from "@/lib/ucat/practice-day-discount-dashboard";
import type { StudentUcatSession } from "@/features/sessions/api/sessions-api";
import type {
  StudyPlanResponse,
  StudyPlanTask,
} from "@/features/study-plan/model/types";
import type { UcatQuotaAreaUsage } from "@/features/ucat-access/types/quota";

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
      studySuggestionsEnabled: true,
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

function quota(
  area: UcatQuotaAreaUsage["area"],
  used: number,
  limit: number,
): UcatQuotaAreaUsage {
  return {
    area,
    label: area,
    used,
    limit,
    period: "day",
    disabled: false,
    atLimit: used >= limit,
  };
}

function discount(
  overrides: Partial<PracticeDiscountDashboardStatus> = {},
): PracticeDiscountDashboardStatus {
  return {
    eligible: true,
    minQuestionsPerDay: 20,
    discountPerDayCents: 200,
    billingInterval: "month",
    currency: "aud",
    earned: 2,
    cap: 10,
    totalDiscountCents: 400,
    periodCapReached: false,
    today: {
      questionsDone: 12,
      minQuestions: 20,
      remainingQuestions: 8,
      earnedCredit: false,
    },
    recentDays: [],
    recentDaysWindowDays: 30,
    ...overrides,
  };
}

describe("dashboard next action", () => {
  const now = new Date("2026-07-15T03:00:00.000Z");

  it("puts a live session ahead of the Study plan task", () => {
    const result = resolveDashboardNextAction({
      now,
      sessions: [
        session("2026-07-15T02:30:00.000Z", "2026-07-15T04:00:00.000Z"),
      ],
      plan: plan([task()]),
      planLoadFailed: false,
      samplerDecided: true,
      samplerCompleted: true,
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
    const result = resolveDashboardNextAction({
      now,
      sessions: [],
      plan: plan([review]),
      planLoadFailed: false,
      samplerDecided: true,
      samplerCompleted: true,
    });
    expect(result.kind).toBe("task");
    expect(result.kind === "task" && result.task.taskType).toBe("review");
    expect(result.kind === "task" && result.fromEarlierStudyDay).toBe(false);
  });

  it("puts unfinished earlier work ahead of today's task", () => {
    const result = resolveDashboardNextAction({
      now,
      sessions: [],
      plan: plan([
        task({ id: "today" }),
        task({ id: "earlier", scheduledDate: "2026-07-14" }),
      ]),
      planLoadFailed: false,
      samplerDecided: true,
      samplerCompleted: true,
    });

    expect(result.kind).toBe("task");
    expect(result.kind === "task" && result.task.id).toBe("earlier");
    expect(result.kind === "task" && result.fromEarlierStudyDay).toBe(true);
  });

  it("respects a deliberate sampler skip and moves on to goal setup", () => {
    const result = resolveDashboardNextAction({
      now,
      sessions: [],
      plan: null,
      planLoadFailed: false,
      samplerDecided: true,
      samplerCompleted: false,
    });
    expect(result).toEqual({ kind: "plan_setup" });
  });

  it("celebrates completed work and identifies the next study day", () => {
    const result = resolveDashboardNextAction({
      now,
      sessions: [],
      plan: plan([
        task({ status: "completed" }),
        task({ id: "later", scheduledDate: "2026-07-18" }),
      ]),
      planLoadFailed: false,
      samplerDecided: true,
      samplerCompleted: true,
    });
    expect(result).toEqual({
      kind: "caught_up",
      nextStudyDate: "2026-07-18",
      hadTasksToday: true,
    });
  });
});

describe("dashboard supporting summaries", () => {
  it("summarizes only the current Study plan week", () => {
    const result = summarizeDashboardWeek(
      plan([
        task({ id: "done", status: "completed", estimatedMinutes: 20 }),
        task({ id: "today", sortOrder: 1, estimatedMinutes: 30 }),
        task({
          id: "later",
          scheduledDate: "2026-07-18",
          estimatedMinutes: 40,
        }),
        task({ id: "next-week", scheduledDate: "2026-07-20" }),
      ]),
    );
    expect(result).toMatchObject({
      totalTasks: 3,
      completedTasks: 1,
      totalMinutes: 90,
      completedMinutes: 20,
      percent: 33,
      status: "on_track",
      nextStudyDate: "2026-07-18",
    });
  });

  it("uses the next task quota when available", () => {
    const areas = [quota("practice", 3, 20), quota("mocks", 1, 2)];
    expect(selectDashboardQuotaArea(areas, "practice")?.area).toBe("practice");
    expect(quotaAreaForTask(task({ taskType: "mock" }))).toBe("mocks");
  });

  it("otherwise selects the most urgent quota", () => {
    const areas = [quota("practice", 3, 20), quota("mocks", 2, 2)];
    expect(selectDashboardQuotaArea(areas, null)?.area).toBe("mocks");
  });

  it("distinguishes discount progress, daily success, and period completion", () => {
    expect(dashboardDiscountState(discount())).toBe("in_progress");
    expect(
      dashboardDiscountState(
        discount({
          today: {
            questionsDone: 20,
            minQuestions: 20,
            remainingQuestions: 0,
            earnedCredit: true,
          },
        }),
      ),
    ).toBe("earned_today");
    expect(dashboardDiscountState(discount({ periodCapReached: true }))).toBe(
      "period_complete",
    );
  });
});
