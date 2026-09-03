import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { StudyPlanCalendar } from "@/features/study-plan/components/study-plan-calendar";
import type {
  StudyPlanResponse,
  StudyPlanTask,
} from "@/features/study-plan/model/types";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  value: ResizeObserverMock,
  writable: true,
});

jest.mock("motion/react", () => ({
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  useReducedMotion: () => false,
}));

jest.mock("@/features/study-plan/components/study-plan-task-list", () => ({
  StudyPlanTaskList: ({ tasks }: { tasks: StudyPlanTask[] }) => (
    <ul>
      {tasks.map((task) => (
        <li key={task.id}>{task.title}</li>
      ))}
    </ul>
  ),
}));

jest.mock("@/features/study-plan/components/study-plan-extra-study", () => ({
  StudyPlanExtraStudy: () => null,
}));

function task(
  id: string,
  scheduledDate: string,
  overrides: Partial<StudyPlanTask> = {},
): StudyPlanTask {
  return {
    id,
    scheduledDate,
    sortOrder: 0,
    taskType: "practice",
    title: `Task ${id}`,
    description: "Focused practice",
    rationale: "Scheduled practice",
    estimatedMinutes: 20,
    targetUnits: 10,
    sectionId: null,
    questionStemCategoryId: null,
    questionTagId: null,
    learningModuleId: null,
    questionSetId: null,
    mockId: null,
    skillTrainerId: null,
    launchPath: "/practice",
    launchConfig: {},
    sourceTaskId: null,
    status: "planned",
    completedUnits: 0,
    startedAt: null,
    completedAt: null,
    skippedAt: null,
    matchedActivityType: null,
    matchedActivityId: null,
    ...overrides,
  };
}

function plan(): StudyPlanResponse {
  const tasks = [task("today", "2026-08-22"), task("tomorrow", "2026-08-23")];
  return {
    profile: {
      id: "profile-1",
      studyPlanEnabled: true,
      targetScore: 2200,
      testYear: 2026,
      testDate: "2026-09-30",
      planningDate: "2026-08-22",
      planningDateIsProvisional: false,
      nextWeeklyReplanOn: null,
      availableDays: [{ weekday: 0 }],
      preferredMockWeekday: 6,
    },
    generation: null,
    tasks,
    nextSteps: [],
    today: "2026-08-22",
    todayTasks: [tasks[0]],
    completion: { completed: 0, scheduledThroughToday: 1, percent: 0 },
  };
}

describe("StudyPlanCalendar", () => {
  it("updates the selected day without remounting its task panel", () => {
    const { container } = render(
      <StudyPlanCalendar plan={plan()} summaryCards={<div />} />,
    );
    const initialPanel = container.querySelector(
      "[data-tour-study-plan-selected-day]",
    );

    fireEvent.click(screen.getByRole("button", { name: /Sunday 23 August/ }));

    expect(screen.getByText("Task tomorrow")).toBeInTheDocument();
    expect(container.querySelector("[data-tour-study-plan-selected-day]")).toBe(
      initialPanel,
    );
  });

  it("shows one day-level alert only when the selected pressure-packed day exceeds 60 minutes", () => {
    const warning = {
      preparationWarning:
        "This is an intensive study day because the remaining preparation demand is high for your available days.",
    };
    const currentPlan = plan();
    const intensiveTasks = [
      task("intensive-1", "2026-08-22", {
        estimatedMinutes: 40,
        launchConfig: warning,
      }),
      task("intensive-2", "2026-08-22", {
        estimatedMinutes: 30,
        launchConfig: warning,
      }),
    ];
    const shortTasks = [
      task("short-1", "2026-08-23", {
        estimatedMinutes: 40,
        launchConfig: warning,
      }),
    ];
    currentPlan.tasks = [...intensiveTasks, ...shortTasks];
    currentPlan.todayTasks = intensiveTasks;

    render(<StudyPlanCalendar plan={currentPlan} summaryCards={<div />} />);

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(
      screen.getByRole("alert", { name: "Intensive study day" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Sunday 23 August/ }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
