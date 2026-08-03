"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@altitutor/ui";
import { Button } from "@/components/ui/button";
import { StudyPlanPage } from "@/features/study-plan/components/study-plan-page";
import { addDays, todayIso } from "@/features/study-plan/lib/dates";
import { generateStudyPlan } from "@/features/study-plan/lib/generator";
import type {
  GeneratedStudyPlanTask,
  StudyPlanCategorySignal,
  StudyPlanResponse,
  StudyPlanSection,
  StudyPlanSectionSignal,
  StudyPlanTask,
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

type EvidenceStage = "new" | "mixed" | "ready";

type SandboxSettings = {
  daysUntilExam: number;
  availableDayCount: number;
  evidenceStage: EvidenceStage;
  naturalPace: number;
  targetScore: number;
};

const SCENARIOS: Array<{
  id: PreviewScenarioId;
  label: string;
  description: string;
  settings: SandboxSettings;
}> = [
  {
    id: "typical_week",
    label: "Mixed section readiness",
    description:
      "VR is still learning while DM and QR have started their pace ladders.",
    settings: {
      daysUntilExam: 100,
      availableDayCount: 5,
      evidenceStage: "mixed",
      naturalPace: 0.8,
      targetScore: 2350,
    },
  },
  {
    id: "foundation",
    label: "New student · learning",
    description: "Coverage-led, untimed work with heavier review and no mocks.",
    settings: {
      daysUntilExam: 240,
      availableDayCount: 3,
      evidenceStage: "new",
      naturalPace: 0.5,
      targetScore: 2100,
    },
  },
  {
    id: "performance_phase",
    label: "Final month · exam mode",
    description:
      "Three mocks per week with targeted work between them and 1.0x calibrations.",
    settings: {
      daysUntilExam: 24,
      availableDayCount: 6,
      evidenceStage: "ready",
      naturalPace: 1.1,
      targetScore: 2450,
    },
  },
  {
    id: "capacity_gap",
    label: "Only one study day",
    description: "A constrained calendar that prioritises the core exam dose.",
    settings: {
      daysUntilExam: 30,
      availableDayCount: 1,
      evidenceStage: "ready",
      naturalPace: 0.9,
      targetScore: 2500,
    },
  },
  {
    id: "still_to_do",
    label: "Earlier work still to do",
    description: "The generated plan plus one incomplete earlier activity.",
    settings: {
      daysUntilExam: 100,
      availableDayCount: 5,
      evidenceStage: "mixed",
      naturalPace: 0.8,
      targetScore: 2350,
    },
  },
  {
    id: "caught_up",
    label: "Today complete",
    description: "Today’s generated work is marked complete.",
    settings: {
      daysUntilExam: 100,
      availableDayCount: 5,
      evidenceStage: "mixed",
      naturalPace: 0.8,
      targetScore: 2350,
    },
  },
  {
    id: "rest_day",
    label: "Unscheduled today",
    description: "Today is removed from the chosen study weekdays.",
    settings: {
      daysUntilExam: 100,
      availableDayCount: 4,
      evidenceStage: "mixed",
      naturalPace: 0.8,
      targetScore: 2350,
    },
  },
  {
    id: "provisional_date",
    label: "Test date not booked",
    description:
      "Uses a provisional planning date while retaining readiness logic.",
    settings: {
      daysUntilExam: 180,
      availableDayCount: 4,
      evidenceStage: "new",
      naturalPace: 0.6,
      targetScore: 2200,
    },
  },
  {
    id: "no_plan",
    label: "No study plan",
    description:
      "The setup state before a goal and study weekdays are supplied.",
    settings: {
      daysUntilExam: 180,
      availableDayCount: 0,
      evidenceStage: "new",
      naturalPace: 0.5,
      targetScore: 2100,
    },
  },
];

const SECTIONS: StudyPlanSection[] = [
  ["vr", "verbal_reasoning", "Verbal Reasoning", "VR", 1, 44, 47],
  ["dm", "decision_making", "Decision Making", "DM", 2, 35, 64],
  ["qr", "quantitative_reasoning", "Quantitative Reasoning", "QR", 3, 36, 42],
  ["sjt", "situational_judgement", "Situational Judgement", "SJ", 4, 69, 32],
].map(([id, key, name, shortName, sectionNumber, questionCount, seconds]) => ({
  id: String(id),
  key: key as StudyPlanSection["key"],
  name: String(name),
  shortName: String(shortName),
  sectionNumber: Number(sectionNumber),
  questionCount: Number(questionCount),
  timePerQuestionSeconds: Number(seconds),
}));

const CATEGORY_NAMES: Record<string, string[]> = {
  vr: ["Reading Comprehension", "True, False, Can’t Tell"],
  dm: [
    "Logical Puzzles",
    "Probabilistic and Statistical Reasoning",
    "Recognising Assumptions",
    "Syllogisms",
    "Venn Diagrams",
  ],
  qr: ["Data Tables", "Graphs and Charts", "Mixed Data Sources"],
  sjt: ["How Appropriate", "How Important"],
};

function evidenceValues(stage: EvidenceStage, ready: boolean) {
  if (stage === "new" || !ready) {
    return {
      attemptedQuestionCount: stage === "mixed" ? 10 : 0,
      completedPracticeSessions: stage === "mixed" ? 1 : 0,
      qualifyingPracticeSessions: stage === "mixed" ? 1 : 0,
      largestPracticeSessionQuestionCount: stage === "mixed" ? 10 : 0,
      recentAccuracy: stage === "mixed" ? 0.62 : null,
    };
  }
  return {
    attemptedQuestionCount: 28,
    completedPracticeSessions: 3,
    qualifyingPracticeSessions: 2,
    largestPracticeSessionQuestionCount: 14,
    recentAccuracy: 0.72,
  };
}

function signals(settings: SandboxSettings): StudyPlanSectionSignal[] {
  return SECTIONS.map((section) => {
    const ready =
      settings.evidenceStage === "ready" ||
      (settings.evidenceStage === "mixed" && section.id !== "vr");
    const evidence = evidenceValues(settings.evidenceStage, ready);
    return {
      sectionId: section.id,
      currentEstimate: section.sectionNumber <= 3 ? (ready ? 680 : 560) : null,
      evidenceCount: ready ? 6 : settings.evidenceStage === "mixed" ? 2 : 0,
      completedFullSets: ready && section.sectionNumber <= 3 ? 1 : 0,
      observedPace: settings.naturalPace,
      ...evidence,
    };
  });
}

function categories(settings: SandboxSettings): StudyPlanCategorySignal[] {
  return Object.entries(CATEGORY_NAMES).flatMap(([sectionId, names]) =>
    names.map((name, index) => {
      const ready =
        settings.evidenceStage === "ready" ||
        (settings.evidenceStage === "mixed" && sectionId === "dm");
      const evidence = evidenceValues(settings.evidenceStage, ready);
      return {
        id: `${sectionId}-${index}`,
        sectionId,
        name,
        availableQuestionCount: 80,
        correctScore: ready ? 15 : 3,
        maxScore: ready ? 20 : 10,
        weaknessScore: ready ? 0.25 + index * 0.02 : 0.65 + index * 0.03,
        observedPace: settings.naturalPace,
        ...evidence,
      };
    }),
  );
}

function asTask(task: GeneratedStudyPlanTask, index: number): StudyPlanTask {
  return {
    ...task,
    id: `study-plan-preview-${index}`,
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

function incompleteEarlierTask(today: string): StudyPlanTask {
  return {
    ...asTask(
      {
        scheduledDate: addDays(today, -2),
        sortOrder: 0,
        taskType: "practice",
        title: "DM syllogisms · untimed",
        description: "Finish the remaining questions.",
        rationale:
          "This incomplete work remains visible until the next replan.",
        estimatedMinutes: 20,
        targetUnits: 10,
        sectionId: "dm",
        questionStemCategoryId: "dm-3",
        questionTagId: null,
        learningModuleId: null,
        questionSetId: null,
        mockId: null,
        skillTrainerId: null,
        launchPath: "/practice",
        launchConfig: {},
      },
      -1,
    ),
    id: "study-plan-preview-incomplete",
  };
}

function makePlan(
  today: string,
  scenarioId: PreviewScenarioId,
  settings: SandboxSettings,
): StudyPlanResponse {
  if (scenarioId === "no_plan") {
    return {
      profile: null,
      generation: null,
      tasks: [],
      nextSteps: [],
      today,
      todayTasks: [],
      completion: { completed: 0, scheduledThroughToday: 0, percent: 0 },
    };
  }
  const planningDate = addDays(today, settings.daysUntilExam);
  const todayWeekday = new Date(`${today}T00:00:00`).getDay();
  const weekdays = [1, 2, 3, 4, 5, 6, 0]
    .filter((day) => scenarioId !== "rest_day" || day !== todayWeekday)
    .slice(0, settings.availableDayCount);
  const profile = {
    studyPlanEnabled: true,
    targetScore: settings.targetScore,
    testYear: Number(planningDate.slice(0, 4)),
    testDate: scenarioId === "provisional_date" ? null : planningDate,
    availableDays: weekdays.map((weekday) => ({
      weekday: weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6,
      maxMinutes: 60,
    })),
    preferredMockWeekday: 6 as const,
  };
  const generated = generateStudyPlan({
    today,
    planningDate,
    profile,
    sections: SECTIONS,
    signals: signals(settings),
    categories: categories(settings),
    learningModules:
      settings.evidenceStage === "new"
        ? [
            {
              id: "preview-learning-module",
              title: "How to approach unfamiliar UCAT questions",
              sectionId: "vr",
              sectionNumber: 1,
              priority: "recommended",
              estimatedMinutes: 15,
              completionPercent: 0,
              relevanceScore: 0.8,
            },
          ]
        : [],
    skillTrainers: [
      {
        id: "preview-trainer",
        key: "decision_making_warmup",
        name: "Decision Making warm-up",
        sectionId: "dm",
        categoryIds: ["dm-3"],
        estimatedMinutes: 3,
      },
    ],
    completedMockCount: settings.evidenceStage === "ready" ? 2 : 0,
  });
  let tasks = generated.tasks.map(asTask);
  if (scenarioId === "still_to_do") {
    tasks = [incompleteEarlierTask(today), ...tasks];
  }
  if (scenarioId === "caught_up") {
    tasks = tasks.map((task) =>
      task.scheduledDate === today
        ? {
            ...task,
            status: "completed" as const,
            completedUnits: task.targetUnits ?? 1,
            completedAt: `${today}T09:00:00.000Z`,
          }
        : task,
    );
  }
  const todayTasks = tasks.filter((task) => task.scheduledDate === today);
  const throughToday = tasks.filter(
    (task) => task.scheduledDate <= today && task.status !== "skipped",
  );
  const completed = throughToday.filter(
    (task) => task.status === "completed",
  ).length;
  return {
    profile: {
      ...profile,
      id: "study-plan-preview-profile",
      planningDate,
      planningDateIsProvisional: scenarioId === "provisional_date",
      nextWeeklyReplanOn: addDays(today, 7),
    },
    generation: {
      id: "study-plan-preview-generation",
      generatedAt: `${today}T00:00:00.000Z`,
      reason: "policy_sandbox",
      startsOn: today,
      endsOn: generated.endsOn,
      capacityRisk: generated.capacityRisk,
      sectionTargets: generated.sectionTargets,
      readiness: generated.readiness,
    },
    tasks,
    nextSteps: [],
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

export function StudyPlanPreviewPage({
  embedded = false,
  initialScenario = "typical_week",
}: {
  embedded?: boolean;
  initialScenario?: PreviewScenarioId;
} = {}) {
  const [scenarioId, setScenarioId] = useState<PreviewScenarioId>(() => {
    if (embedded) return initialScenario;
    if (typeof window === "undefined") return "typical_week";
    const requested = new URLSearchParams(window.location.search).get(
      "scenario",
    );
    return SCENARIOS.some((scenario) => scenario.id === requested)
      ? (requested as PreviewScenarioId)
      : "typical_week";
  });
  const selectedScenario =
    SCENARIOS.find((scenario) => scenario.id === scenarioId) ?? SCENARIOS[0]!;
  const [settings, setSettings] = useState<SandboxSettings>(
    selectedScenario.settings,
  );
  const today = todayIso();
  const plan = useMemo(
    () => makePlan(today, scenarioId, settings),
    [scenarioId, settings, today],
  );

  function chooseScenario(next: PreviewScenarioId) {
    const scenario = SCENARIOS.find((candidate) => candidate.id === next);
    if (!scenario) return;
    setScenarioId(next);
    setSettings(scenario.settings);
    window.history.replaceState(
      null,
      "",
      `/study-plan/preview?scenario=${next}`,
    );
  }

  return (
    <div className="space-y-7 pb-8">
      {!embedded ? (
        <div className="space-y-4 rounded-2xl border bg-muted/25 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <Badge variant="secondary">Deterministic policy sandbox</Badge>
              <h1 className="mt-2 text-2xl font-semibold">
                Study plan state lab
              </h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {selectedScenario.description} These controls run the real
                planner locally and never write to student data.
              </p>
            </div>
            <label className="text-sm font-medium">
              Scenario
              <select
                value={scenarioId}
                onChange={(event) =>
                  chooseScenario(event.target.value as PreviewScenarioId)
                }
                className="mt-1 block min-w-64 rounded-lg border bg-background px-3 py-2 text-sm"
              >
                {SCENARIOS.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {scenarioId !== "no_plan" ? (
            <div className="grid gap-3 border-t pt-4 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-xs font-medium text-muted-foreground">
                Days until exam
                <input
                  type="number"
                  min={1}
                  max={540}
                  value={settings.daysUntilExam}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      daysUntilExam: Math.max(1, Number(event.target.value)),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Available days/week
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={settings.availableDayCount}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      availableDayCount: Math.max(
                        1,
                        Math.min(7, Number(event.target.value)),
                      ),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Evidence stage
                <select
                  value={settings.evidenceStage}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      evidenceStage: event.target.value as EvidenceStage,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
                >
                  <option value="new">New</option>
                  <option value="mixed">Mixed readiness</option>
                  <option value="ready">Timing ready</option>
                </select>
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Natural pace
                <input
                  type="number"
                  min={0.5}
                  max={1.3}
                  step={0.1}
                  value={settings.naturalPace}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      naturalPace: Math.max(
                        0.5,
                        Math.min(1.3, Number(event.target.value)),
                      ),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                Target score
                <input
                  type="number"
                  min={900}
                  max={2700}
                  step={50}
                  value={settings.targetScore}
                  onChange={(event) =>
                    setSettings((current) => ({
                      ...current,
                      targetScore: Number(event.target.value),
                    }))
                  }
                  className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground"
                />
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      <StudyPlanPage previewPlan={plan} />

      {!embedded ? (
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/study-plan">Return to live study plan</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/dashboard/preview">Open dashboard preview</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
