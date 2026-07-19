"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, CardContent } from "@altitutor/ui";
import {
  ArrowRight,
  BrainCircuit,
  ClipboardCheck,
  FileStack,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DashboardTrajectoryHero,
  DashboardWeekProgress,
} from "@/features/dashboard/components/dashboard-home";
import type { DashboardMockAnnotation } from "@/features/dashboard/components/dashboard-trajectory-chart";
import type { DashboardNextAction } from "@/features/dashboard/lib/dashboard-home";
import { summarizeDashboardWeek } from "@/features/dashboard/lib/dashboard-home";
import {
  buildDashboardTrajectoryChartData,
  resolveDashboardTrajectory,
} from "@/features/dashboard/lib/dashboard-trajectory";
import type {
  ProjectionConfidence,
  ProjectionPoint,
  ScoreProjectionSnapshot,
  SectionScoreProjection,
  TotalScoreProjection,
} from "@/features/score-projection/types/score-projection";
import { addDays, todayIso } from "@/features/study-plan/lib/dates";
import type {
  StudyPlanResponse,
  StudyPlanTask,
} from "@/features/study-plan/model/types";
import { UCAT_CARD_CHROME } from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";

type PreviewScenarioId =
  | "no_plan"
  | "baseline"
  | "early_estimate"
  | "no_exact_date"
  | "long_range"
  | "on_track"
  | "within_reach"
  | "needs_adjustment"
  | "rest_day"
  | "projection_error";

type PreviewScenario = {
  id: PreviewScenarioId;
  label: string;
  description: string;
  planTier: "free" | "paid";
  targetScore: number;
  testDate: string | null | "long_range";
  confidence: ProjectionConfidence | null;
  currentEstimate: number | null;
  readySections: number;
  action: "task" | "caught_up" | "plan_setup";
  projectionError?: boolean;
};

const SCENARIOS: PreviewScenario[] = [
  {
    id: "no_plan",
    label: "No Study plan",
    description: "Blurred canvas and plan-setup action; no sample score.",
    planTier: "free",
    targetScore: 2350,
    testDate: null,
    confidence: null,
    currentEstimate: null,
    readySections: 0,
    action: "plan_setup",
  },
  {
    id: "baseline",
    label: "Building baseline",
    description: "A plan exists, but only one cognitive section is ready.",
    planTier: "free",
    targetScore: 2350,
    testDate: "exact",
    confidence: null,
    currentEstimate: null,
    readySections: 1,
    action: "task",
  },
  {
    id: "early_estimate",
    label: "Early estimate",
    description: "Low-confidence range without on-track judgement.",
    planTier: "paid",
    targetScore: 2350,
    testDate: "exact",
    confidence: "low",
    currentEstimate: 1940,
    readySections: 3,
    action: "task",
  },
  {
    id: "no_exact_date",
    label: "No exact date",
    description: "Bounded 120-day outlook; test year remains provisional.",
    planTier: "free",
    targetScore: 2400,
    testDate: null,
    confidence: "medium",
    currentEstimate: 2050,
    readySections: 3,
    action: "task",
  },
  {
    id: "long_range",
    label: "Distant test",
    description: "The test date is beyond the reliable forecast horizon.",
    planTier: "paid",
    targetScore: 2450,
    testDate: "long_range",
    confidence: "medium",
    currentEstimate: 2050,
    readySections: 3,
    action: "task",
  },
  {
    id: "on_track",
    label: "On track",
    description: "The target is below the lower test-day range.",
    planTier: "paid",
    targetScore: 2180,
    testDate: "exact",
    confidence: "high",
    currentEstimate: 2070,
    readySections: 3,
    action: "task",
  },
  {
    id: "within_reach",
    label: "Within reach",
    description: "The target sits inside the plausible test-day range.",
    planTier: "free",
    targetScore: 2350,
    testDate: "exact",
    confidence: "medium",
    currentEstimate: 2050,
    readySections: 3,
    action: "task",
  },
  {
    id: "needs_adjustment",
    label: "Needs adjustment",
    description: "The target is above the optimistic test-day range.",
    planTier: "paid",
    targetScore: 2580,
    testDate: "exact",
    confidence: "medium",
    currentEstimate: 1980,
    readySections: 3,
    action: "task",
  },
  {
    id: "rest_day",
    label: "Rest day",
    description: "Reliable estimate, with no prescribed work today.",
    planTier: "paid",
    targetScore: 2350,
    testDate: "exact",
    confidence: "high",
    currentEstimate: 2100,
    readySections: 3,
    action: "caught_up",
  },
  {
    id: "projection_error",
    label: "Projection unavailable",
    description: "The Study plan remains usable while score evidence reloads.",
    planTier: "free",
    targetScore: 2350,
    testDate: "exact",
    confidence: "medium",
    currentEstimate: 2050,
    readySections: 3,
    action: "task",
    projectionError: true,
  },
];

function makeTask(
  today: string,
  overrides: Partial<StudyPlanTask> = {},
): StudyPlanTask {
  return {
    id: "preview-task",
    scheduledDate: today,
    sortOrder: 0,
    taskType: "practice",
    title: "Strengthen Quantitative Reasoning",
    description: "Complete a focused timed block, then review each miss.",
    rationale:
      "Quantitative Reasoning currently has the largest gap to its section target.",
    estimatedMinutes: 25,
    targetUnits: 18,
    sectionId: "qr",
    questionStemCategoryId: null,
    questionTagId: null,
    learningModuleId: null,
    questionSetId: null,
    mockId: null,
    skillTrainerId: null,
    launchPath: "/practice",
    launchConfig: {},
    status: "planned",
    completedUnits: 0,
    startedAt: null,
    completedAt: null,
    skippedAt: null,
    matchedActivityType: null,
    matchedActivityId: null,
    ...overrides,
    sourceTaskId: overrides.sourceTaskId ?? null,
  };
}

function makeProjection(today: string, current: number): ProjectionPoint[] {
  return [
    {
      day: 0,
      date: today,
      pessimistic: current,
      realistic: current,
      optimistic: current,
    },
    {
      day: 30,
      date: addDays(today, 30),
      pessimistic: current + 35,
      realistic: current + 75,
      optimistic: current + 115,
    },
    {
      day: 60,
      date: addDays(today, 60),
      pessimistic: current + 70,
      realistic: current + 145,
      optimistic: current + 215,
    },
    {
      day: 90,
      date: addDays(today, 90),
      pessimistic: current + 110,
      realistic: current + 210,
      optimistic: current + 300,
    },
    {
      day: 120,
      date: addDays(today, 120),
      pessimistic: current + 140,
      realistic: current + 260,
      optimistic: current + 370,
    },
  ];
}

function makeSections(
  readySections: number,
  confidence: ProjectionConfidence | null,
): SectionScoreProjection[] {
  const scores = [700, 690, 650];
  const names = [
    "Verbal Reasoning",
    "Decision Making",
    "Quantitative Reasoning",
  ];
  return names.map((sectionName, index) => ({
    sectionId: ["vr", "dm", "qr"][index]!,
    sectionName,
    sectionNumber: index + 1,
    currentEstimate: index < readySections ? scores[index]! : null,
    confidence: index < readySections ? (confidence ?? "low") : "low",
    uncertainty: index < readySections ? 35 : 300,
    effectiveEvidenceWeight: index < readySections ? 4 : 0,
    evidenceCount: index < readySections ? 3 : 0,
    paceSource: "recent_activity",
    effectivePracticePerWeek: 90,
    history: [],
    projection:
      index < readySections ? makeProjection(todayIso(), scores[index]!) : [],
    horizons: [],
  }));
}

function makeTotal(
  today: string,
  currentEstimate: number | null,
  confidence: ProjectionConfidence | null,
): TotalScoreProjection | null {
  if (currentEstimate == null || confidence == null) return null;
  return {
    currentEstimate,
    confidence,
    uncertainty:
      confidence === "low" ? 180 : confidence === "medium" ? 110 : 70,
    effectiveEvidenceWeight: confidence === "low" ? 2 : 8,
    missingSectionNumbers: [],
    history: [],
    projection: makeProjection(today, currentEstimate),
    horizons: [],
  };
}

function makeSnapshots(
  today: string,
  current: number | null,
): ScoreProjectionSnapshot[] {
  if (current == null) return [];
  return [-60, -45, -30, -15, 0].map((day, index) => ({
    date: addDays(today, day),
    currentEstimate: current - (4 - index) * 35,
    confidence: index < 2 ? "low" : "medium",
    uncertainty: 150 - index * 15,
    effectiveEvidenceWeight: 2 + index,
    sectionEstimates: {},
  }));
}

function makePlan(
  today: string,
  scenario: PreviewScenario,
): StudyPlanResponse | null {
  if (scenario.id === "no_plan") return null;
  const testDate =
    scenario.testDate === "long_range"
      ? addDays(today, 365)
      : scenario.testDate === "exact"
        ? addDays(today, 90)
        : null;
  const tasks = [
    makeTask(today),
    makeTask(today, {
      id: "preview-complete",
      title: "Review Decision Making set",
      scheduledDate: addDays(today, -1),
      status: "completed",
      completedAt: `${addDays(today, -1)}T10:00:00.000Z`,
      estimatedMinutes: 20,
    }),
    ...[21, 49, 77].map((day, index) =>
      makeTask(today, {
        id: `preview-mock-${index}`,
        scheduledDate: addDays(today, day),
        sortOrder: index + 2,
        taskType: "mock",
        title: `Full mock ${index + 1}`,
        description: "Complete a full timed UCAT mock.",
        rationale: "Scheduled evidence checkpoint.",
        estimatedMinutes: 120,
        targetUnits: 1,
        mockId: `mock-${index}`,
        launchPath: `/mocks/mock-${index}`,
      }),
    ),
  ];
  return {
    profile: {
      id: "preview-profile",
      studyPlanEnabled: true,
      studySuggestionsEnabled: true,
      targetScore: scenario.targetScore,
      testYear: Number((testDate ?? addDays(today, 365)).slice(0, 4)),
      testDate,
      availableDays: [1, 3, 5].map((weekday) => ({
        weekday: weekday as 1 | 3 | 5,
        maxMinutes: 45,
      })),
      preferredMockWeekday: 6,
      planningDate: testDate ?? addDays(today, 365),
      planningDateIsProvisional: testDate == null,
      nextWeeklyReplanOn: addDays(today, 7),
    },
    generation: {
      id: "preview-generation",
      generatedAt: `${today}T00:00:00.000Z`,
      reason: "preview",
      startsOn: today,
      endsOn: testDate ?? addDays(today, 365),
      capacityRisk: {
        level: "none",
        availableMinutesPerWeek: 135,
        recommendedMinutesPerWeek: 120,
        message: null,
      },
      sectionTargets: { vr: 760, dm: 760, qr: 780 },
    },
    tasks,
    nextSteps: [],
    today,
    todayTasks: scenario.action === "caught_up" ? [] : [tasks[0]!],
    completion: { completed: 1, scheduledThroughToday: 2, percent: 50 },
  };
}

function PreviewMembership({ tier }: { tier: PreviewScenario["planTier"] }) {
  return (
    <Card className={cn(UCAT_CARD_CHROME, "h-full")}>
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold">
            {tier === "free" ? "Practice quota" : "Practice-day reward"}
          </h2>
          <Badge variant="secondary">
            {tier === "free" ? "UCAT Free" : "Paid plan"}
          </Badge>
        </div>
        <p className="mt-4 text-sm font-medium">
          {tier === "free"
            ? "9 practice questions remaining this week"
            : "18 of 30 eligible questions today"}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-3/5 rounded-full bg-primary" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {tier === "free"
            ? "Unlimited removes online quotas and adds practice-day rewards."
            : "Keep practising accurately to earn today’s reward."}
        </p>
      </CardContent>
    </Card>
  );
}

function PreviewRecentAttempts() {
  const rows = [
    {
      icon: BrainCircuit,
      name: "Quantitative Reasoning practice",
      detail: "14/18 correct · Today",
    },
    {
      icon: FileStack,
      name: "Decision Making set",
      detail: "720 scaled · Yesterday",
    },
    {
      icon: ClipboardCheck,
      name: "Full mock",
      detail: "2110 scaled · 4 days ago",
    },
  ];
  return (
    <Card className={cn(UCAT_CARD_CHROME, "h-full")}>
      <CardContent className="p-5 sm:p-6">
        <h2 className="font-semibold">Recent attempts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Revisit feedback while the reasoning is fresh.
        </p>
        <div className="mt-4 divide-y divide-border/60">
          {rows.map(({ icon: Icon, name, detail }) => (
            <div key={name} className="flex items-center gap-3 py-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {detail}
                </span>
              </span>
              <span className="flex items-center gap-1 text-xs font-medium text-primary">
                Review <ArrowRight className="size-3.5" aria-hidden />
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardPreviewPage() {
  const [scenarioId, setScenarioId] = useState<PreviewScenarioId>(() => {
    if (typeof window === "undefined") return "within_reach";
    const requested = new URLSearchParams(window.location.search).get(
      "scenario",
    );
    return SCENARIOS.some((scenario) => scenario.id === requested)
      ? (requested as PreviewScenarioId)
      : "within_reach";
  });
  const scenario = SCENARIOS.find((candidate) => candidate.id === scenarioId)!;
  const today = todayIso();
  const model = useMemo(() => {
    const plan = makePlan(today, scenario);
    const sections = makeSections(scenario.readySections, scenario.confidence);
    const total = makeTotal(
      today,
      scenario.currentEstimate,
      scenario.confidence,
    );
    const state = plan?.profile
      ? resolveDashboardTrajectory({
          today,
          targetScore: plan.profile.targetScore,
          testDate: plan.profile.testDate,
          total,
          sections,
        })
      : null;
    const snapshots = makeSnapshots(today, scenario.currentEstimate);
    const chartData = total
      ? buildDashboardTrajectoryChartData(
          total,
          snapshots,
          today,
          state?.projectedAtTest,
        )
      : [];
    const action: DashboardNextAction =
      scenario.action === "plan_setup"
        ? { kind: "plan_setup" }
        : scenario.action === "caught_up"
          ? {
              kind: "caught_up",
              nextStudyDate: addDays(today, 2),
              hadTasksToday: false,
            }
          : {
              kind: "task",
              task: plan!.todayTasks[0]!,
              fromEarlierStudyDay: false,
            };
    const mocks: DashboardMockAnnotation[] =
      plan?.tasks
        .filter((task) => task.taskType === "mock")
        .map((task, index) => ({
          date: task.scheduledDate,
          label: `M${index + 1}`,
          title: task.title,
          completed: task.status === "completed",
        })) ?? [];
    return { plan, sections, snapshots, state, chartData, action, mocks };
  }, [scenario, today]);
  const week = model.plan ? summarizeDashboardWeek(model.plan) : null;

  return (
    <div className="space-y-6 pb-8">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <Badge variant="secondary">Development preview</Badge>
          <h1 className="mt-2 text-2xl font-semibold">Dashboard state lab</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {scenario.description}
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
                `/dashboard/preview?scenario=${next}`,
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

      <DashboardTrajectoryHero
        firstName="Preview student"
        plan={model.plan}
        action={model.action}
        state={model.state}
        chartData={model.chartData}
        sections={model.sections}
        snapshots={model.snapshots}
        projectionLoading={false}
        projectionError={Boolean(scenario.projectionError)}
        mocks={model.mocks}
        onStartTask={async () => undefined}
        taskPending={false}
        taskError={null}
        onRetryPlan={() => undefined}
      />

      <div className="mx-auto grid w-full max-w-[1400px] gap-5 px-5 sm:px-6 lg:grid-cols-3">
        <Card className={cn(UCAT_CARD_CHROME, "h-full")}>
          <CardContent className="p-5 sm:p-6">
            <DashboardWeekProgress
              week={week}
              sessionToday={null}
              samplerDecided
              samplerCompleted={scenario.id !== "no_plan"}
            />
          </CardContent>
        </Card>
        <PreviewMembership tier={scenario.planTier} />
        <PreviewRecentAttempts />
      </div>

      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap gap-2 px-5 sm:px-6">
        <Button asChild variant="outline">
          <Link href="/dashboard">Return to live dashboard</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/study-plan/preview">Open Study plan preview</Link>
        </Button>
      </div>
    </div>
  );
}
