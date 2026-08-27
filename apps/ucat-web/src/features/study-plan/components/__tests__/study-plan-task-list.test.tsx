import React from "react";
import { render, screen } from "@testing-library/react";
import { StudyPlanTaskList } from "@/features/study-plan/components/study-plan-task-list";
import type { StudyPlanTask } from "@/features/study-plan/model/types";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

jest.mock("motion/react", () => ({
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  motion: {
    ul: ({ children, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
      <ul {...props}>{children}</ul>
    ),
    li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => (
      <li {...props}>{children}</li>
    ),
  },
  useReducedMotion: () => false,
}));

jest.mock("@/features/study-plan/hooks/use-study-plan-task-actions", () => ({
  useStudyPlanTaskActions: () => ({
    error: null,
    pendingAction: null,
    skipTask: jest.fn(),
    startTask: jest.fn(),
    unskipTask: jest.fn(),
    futureStartPromptOpen: false,
    currentRecommendedTask: null,
    setFutureStartPromptOpen: jest.fn(),
    continueFutureTask: jest.fn(),
    startCurrentRecommendedTask: jest.fn(),
  }),
}));

function task(id: string, scheduledDate: string): StudyPlanTask {
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
  };
}

describe("StudyPlanTaskList", () => {
  it("replaces tasks without remounting the list when the selected day is unchanged", () => {
    const { rerender, container } = render(
      <StudyPlanTaskList
        revealKey="2026-08-22"
        tasks={[task("today", "2026-08-22")]}
        today="2026-08-22"
      />,
    );
    const list = container.querySelector("ul");

    rerender(
      <StudyPlanTaskList
        revealKey="2026-08-22"
        tasks={[task("today-updated", "2026-08-22")]}
        today="2026-08-22"
      />,
    );

    expect(container.querySelector("ul")).toBe(list);
    expect(screen.getByText("Task today-updated")).toBeInTheDocument();
  });

  it("mounts a new list when the selected day changes", () => {
    const { rerender, container } = render(
      <StudyPlanTaskList
        revealKey="2026-08-22"
        tasks={[task("today", "2026-08-22")]}
        today="2026-08-22"
      />,
    );
    const list = container.querySelector("ul");

    rerender(
      <StudyPlanTaskList
        revealKey="2026-08-23"
        tasks={[task("tomorrow", "2026-08-23")]}
        today="2026-08-22"
      />,
    );

    expect(container.querySelector("ul")).not.toBe(list);
    expect(screen.getByText("Task tomorrow")).toBeInTheDocument();
    expect(screen.queryByText("Task today")).not.toBeInTheDocument();
  });
});
