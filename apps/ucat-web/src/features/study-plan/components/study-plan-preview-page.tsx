"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { StudyPlanPage } from "@/features/study-plan/components/study-plan-page";
import { addDays, todayIso } from "@/features/study-plan/lib/dates";
import type {
  StudyPlanResponse,
  StudyPlanTask,
  StudyPlanTaskStatus,
  StudyPlanTaskType,
} from "@/features/study-plan/model/types";

type PreviewScenarioId =
  | "no_plan"
  | "foundation"
  | "typical_week"
  | "still_to_do"
  | "caught_up"
  | "rest_day"
  | "performance_phase"
  | "capacity_gap"
  | "provisional_date";

type PreviewScenario = {
  id: PreviewScenarioId;
  label: string;
  description: string;
};

const SCENARIOS: PreviewScenario[] = [
  {
    id: "typical_week",
    label: "Typical study week",
    description: "A balanced day with warm-up, targeted practice, and review.",
  },
  {
    id: "foundation",
    label: "New student · foundation",
    description: "Learning-led work with short, untimed feedback loops.",
  },
  {
    id: "still_to_do",
    label: "Earlier work still to do",
    description:
      "Unfinished work from a previous day appears before today’s tasks.",
  },
  {
    id: "caught_up",
    label: "Today complete",
    description:
      "All prescribed work is complete and extra study is available.",
  },
  {
    id: "rest_day",
    label: "Unscheduled day",
    description:
      "No prescribed work today, with the option to ask for a useful block.",
  },
  {
    id: "performance_phase",
    label: "Experienced · performance",
    description:
      "Timed full sets, review, and a mock checkpoint near test day.",
  },
  {
    id: "capacity_gap",
    label: "Capacity gap",
    description:
      "The student’s availability is below the recommended weekly load.",
  },
  {
    id: "provisional_date",
    label: "Test date not booked",
    description: "The plan works toward a provisional UCAT testing window.",
  },
  {
    id: "no_plan",
    label: "No Study plan",
    description: "The setup state before target and availability are supplied.",
  },
];

function task(
  today: string,
  id: string,
  dayOffset: number,
  sortOrder: number,
  taskType: StudyPlanTaskType,
  title: string,
  overrides: Partial<StudyPlanTask> = {},
): StudyPlanTask {
  const status = overrides.status ?? "planned";
  return {
    id: `study-plan-preview-${id}`,
    scheduledDate: addDays(today, dayOffset),
    sortOrder,
    taskType,
    title,
    description:
      "Complete this focused activity, then use the feedback before moving on.",
    rationale:
      "This is the highest-value next step for the student’s current phase and score gaps.",
    estimatedMinutes:
      taskType === "mock" ? 120 : taskType === "learn" ? 12 : 20,
    targetUnits: taskType === "mock" || taskType === "review" ? 1 : 12,
    sectionId: taskType === "skill_trainer" ? "dm" : "vr",
    questionStemCategoryId: null,
    questionTagId: null,
    learningModuleId: taskType === "learn" ? `module-${id}` : null,
    questionSetId: taskType === "section_benchmark" ? `set-${id}` : null,
    mockId: taskType === "mock" ? `mock-${id}` : null,
    skillTrainerId: taskType === "skill_trainer" ? `trainer-${id}` : null,
    launchPath: taskType === "learn" ? `/learn/module-${id}` : "/practice",
    launchConfig: {},
    status,
    completedUnits: status === "completed" ? 1 : 0,
    startedAt:
      status === "in_progress" || status === "partial"
        ? `${addDays(today, dayOffset)}T08:30:00.000Z`
        : null,
    completedAt:
      status === "completed"
        ? `${addDays(today, dayOffset)}T09:00:00.000Z`
        : null,
    skippedAt:
      status === "skipped"
        ? `${addDays(today, dayOffset)}T09:00:00.000Z`
        : null,
    matchedActivityType: status === "completed" ? taskType : null,
    matchedActivityId: status === "completed" ? `activity-${id}` : null,
    ...overrides,
    sourceTaskId: overrides.sourceTaskId ?? null,
  };
}

function baseTasks(today: string): StudyPlanTask[] {
  return [
    task(
      today,
      "past-practice",
      -3,
      0,
      "practice",
      "VR reading comprehension · untimed",
      {
        status: "completed",
        estimatedMinutes: 18,
      },
    ),
    task(today, "warm-up", 0, 0, "skill_trainer", "Syllogism speed warm-up", {
      estimatedMinutes: 6,
      targetUnits: 1,
    }),
    task(
      today,
      "focused-practice",
      0,
      1,
      "practice",
      "Reading Comprehension · 0.75× speed",
      {
        estimatedMinutes: 22,
        targetUnits: 16,
      },
    ),
    task(
      today,
      "review",
      0,
      2,
      "review",
      "Review today’s Reading Comprehension attempt",
      {
        estimatedMinutes: 7,
        launchConfig: { awaitingAttempt: true },
      },
    ),
    task(today, "dm-learning", 2, 0, "learn", "Decision Making foundations"),
    task(today, "qr-practice", 4, 0, "practice", "QR problem solving · timed", {
      sectionId: "qr",
      estimatedMinutes: 28,
    }),
    task(today, "vr-set", 7, 0, "section_benchmark", "Full VR benchmark set", {
      estimatedMinutes: 32,
      targetUnits: 1,
    }),
    task(today, "mock-one", 14, 0, "mock", "Full UCAT mock 1"),
    task(today, "mock-two", 42, 0, "mock", "Full UCAT mock 2"),
  ];
}

function withStatus(taskToUpdate: StudyPlanTask, status: StudyPlanTaskStatus) {
  return {
    ...taskToUpdate,
    status,
    completedUnits:
      status === "completed" ? (taskToUpdate.targetUnits ?? 1) : 0,
    completedAt:
      status === "completed"
        ? `${taskToUpdate.scheduledDate}T09:00:00.000Z`
        : null,
  };
}

function makePlan(
  today: string,
  scenarioId: PreviewScenarioId,
): StudyPlanResponse {
  if (scenarioId === "no_plan") {
    return {
      profile: null,
      generation: null,
      tasks: [],
      today,
      todayTasks: [],
      completion: { completed: 0, scheduledThroughToday: 0, percent: 0 },
    };
  }

  let tasks = baseTasks(today);
  let testDate: string | null = addDays(today, 70);
  let capacityWarning = false;

  if (scenarioId === "foundation") {
    tasks = [
      task(
        today,
        "foundation-learn",
        0,
        0,
        "learn",
        "How Verbal Reasoning works",
      ),
      task(
        today,
        "foundation-trainer",
        0,
        1,
        "skill_trainer",
        "Reading focus warm-up",
        {
          estimatedMinutes: 5,
        },
      ),
      task(
        today,
        "foundation-practice",
        0,
        2,
        "practice",
        "Reading Comprehension mini-set · untimed",
        {
          estimatedMinutes: 12,
          targetUnits: 6,
        },
      ),
      task(today, "foundation-dm", 2, 0, "learn", "Syllogism foundations"),
      task(today, "foundation-qr", 4, 0, "learn", "Essential QR arithmetic"),
      task(
        today,
        "foundation-benchmark",
        12,
        0,
        "section_benchmark",
        "First VR full set",
        {
          estimatedMinutes: 30,
        },
      ),
    ];
  }

  if (scenarioId === "still_to_do") {
    tasks = [
      task(today, "carry-over", -2, 0, "practice", "DM syllogisms · untimed", {
        estimatedMinutes: 18,
        sectionId: "dm",
      }),
      ...tasks,
    ];
  }

  if (scenarioId === "caught_up") {
    tasks = tasks.map((entry) =>
      entry.scheduledDate === today ? withStatus(entry, "completed") : entry,
    );
  }

  if (scenarioId === "rest_day") {
    tasks = tasks.filter((entry) => entry.scheduledDate !== today);
  }

  if (scenarioId === "performance_phase") {
    testDate = addDays(today, 24);
    tasks = [
      task(
        today,
        "performance-warmup",
        0,
        0,
        "skill_trainer",
        "Numpad speed warm-up",
        {
          estimatedMinutes: 4,
          sectionId: "qr",
        },
      ),
      task(
        today,
        "performance-set",
        0,
        1,
        "section_benchmark",
        "Full QR set · exam speed",
        {
          estimatedMinutes: 28,
          sectionId: "qr",
        },
      ),
      task(today, "performance-review", 0, 2, "review", "Review full QR set", {
        estimatedMinutes: 9,
        launchConfig: { awaitingAttempt: true },
      }),
      task(today, "performance-mock", 3, 0, "mock", "Full UCAT mock 5"),
      task(
        today,
        "performance-vr",
        6,
        0,
        "section_benchmark",
        "Full VR set · exam speed",
      ),
      task(today, "performance-mock-final", 10, 0, "mock", "Full UCAT mock 6"),
      task(
        today,
        "performance-taper",
        21,
        0,
        "practice",
        "Light confidence practice",
        {
          estimatedMinutes: 15,
        },
      ),
    ];
  }

  if (scenarioId === "capacity_gap") capacityWarning = true;
  if (scenarioId === "provisional_date") testDate = null;

  const todayTasks = tasks.filter((entry) => entry.scheduledDate === today);
  const throughToday = tasks.filter(
    (entry) => entry.scheduledDate <= today && entry.status !== "skipped",
  );
  const completed = throughToday.filter(
    (entry) => entry.status === "completed",
  ).length;

  return {
    profile: {
      id: "study-plan-preview-profile",
      targetScore: scenarioId === "performance_phase" ? 2450 : 2350,
      testYear: Number((testDate ?? addDays(today, 180)).slice(0, 4)),
      testDate,
      availableDays: [1, 3, 5].map((weekday) => ({
        weekday: weekday as 1 | 3 | 5,
        maxMinutes: capacityWarning ? 20 : 60,
      })),
      preferredMockWeekday: 6,
      planningDate: testDate ?? addDays(today, 120),
      planningDateIsProvisional: testDate == null,
      nextWeeklyReplanOn: addDays(today, 7),
    },
    generation: {
      id: "study-plan-preview-generation",
      generatedAt: `${today}T00:00:00.000Z`,
      reason: "development_preview",
      startsOn: addDays(today, -7),
      endsOn: testDate ?? addDays(today, 120),
      capacityRisk: {
        level: capacityWarning ? "warning" : "none",
        availableMinutesPerWeek: capacityWarning ? 60 : 180,
        recommendedMinutesPerWeek: 150,
        message: capacityWarning
          ? "The student has 90 fewer minutes available than the plan recommends each week."
          : null,
      },
      sectionTargets: { vr: 780, dm: 780, qr: 790 },
    },
    tasks,
    today,
    todayTasks,
    completion: {
      completed,
      scheduledThroughToday: throughToday.length,
      percent: throughToday.length
        ? Math.round((completed / throughToday.length) * 100)
        : 0,
    },
  };
}

export function StudyPlanPreviewPage() {
  const [scenarioId, setScenarioId] = useState<PreviewScenarioId>(() => {
    if (typeof window === "undefined") return "typical_week";
    const requested = new URLSearchParams(window.location.search).get(
      "scenario",
    );
    return SCENARIOS.some((scenario) => scenario.id === requested)
      ? (requested as PreviewScenarioId)
      : "typical_week";
  });
  const scenario = SCENARIOS.find((candidate) => candidate.id === scenarioId)!;
  const today = todayIso();
  const plan = useMemo(() => makePlan(today, scenarioId), [scenarioId, today]);

  return (
    <div className="space-y-7 pb-8">
      <div className="flex flex-col gap-3 rounded-2xl border bg-muted/25 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="secondary">Development preview</Badge>
          <h1 className="mt-2 text-2xl font-semibold">Study plan state lab</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {scenario.description} Preview controls are intentionally disabled
            and never write to student data.
          </p>
        </div>
        <label className="text-sm font-medium">
          Scenario
          <select
            value={scenarioId}
            onChange={(event) => {
              const next = event.target.value as PreviewScenarioId;
              setScenarioId(next);
              window.history.replaceState(
                null,
                "",
                `/study-plan/preview?scenario=${next}`,
              );
            }}
            className="mt-1 block min-w-64 rounded-lg border bg-background px-3 py-2 text-sm"
          >
            {SCENARIOS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <StudyPlanPage previewPlan={plan} />

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/study-plan">Return to live Study plan</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/dashboard/preview">Open dashboard preview</Link>
        </Button>
      </div>
    </div>
  );
}
