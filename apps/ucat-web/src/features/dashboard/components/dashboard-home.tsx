"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Badge, Card, CardContent, Skeleton } from "@altitutor/ui";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Check,
  Gauge,
  Clock3,
  NotebookText,
  RotateCcw,
  Target,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardMembershipValue } from "@/features/dashboard/components/dashboard-membership-value";
import {
  DashboardTrajectoryChart,
  type DashboardMockAnnotation,
  type DashboardTargetBreakdown,
} from "@/features/dashboard/components/dashboard-trajectory-chart";
import { DashboardRecentAttemptsCard } from "@/features/dashboard/components/dashboard-recent-attempts-card";
import { DashboardActivationChecklist } from "@/features/dashboard/components/dashboard-activation-checklist";
import {
  describeStudyNextAction,
  formatDashboardDate,
  resolveDashboardNextAction,
  summarizeDashboardWeek,
  type DashboardNextAction,
  type DashboardWeekSummary,
} from "@/features/dashboard/lib/dashboard-home";
import {
  buildDashboardTrajectoryChartData,
  resolveDashboardTrajectory,
  type DashboardTrajectoryState,
} from "@/features/dashboard/lib/dashboard-trajectory";
import { buildDashboardTrajectoryInsight } from "@/features/dashboard/lib/dashboard-trajectory-insight";
import { formatDashboardTestCountdown } from "@/features/dashboard/lib/dashboard-test-countdown";
import { buildDashboardPlanInsight } from "@/features/dashboard/lib/dashboard-plan-insight";
import { useUcatProfile } from "@/features/layout/hooks/use-ucat-profile";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";
import {
  UCAT_GUIDED_SAMPLER_COMPLETED,
  UCAT_GUIDED_SAMPLER_DECIDED,
  UCAT_STUDY_PLAN_DECIDED,
} from "@/features/onboarding/lib/activation-milestones";
import { type StudentUcatSession } from "@/features/sessions/api/sessions-api";
import { useStudentUcatSessions } from "@/features/sessions/hooks/use-sessions";
import { deriveTotalScoreProjection } from "@/features/score-projection/lib/total-projection";
import { useScoreProjection } from "@/features/score-projection/hooks/use-score-projection";
import type {
  ScoreProjectionSnapshot,
  SectionScoreProjection,
} from "@/features/score-projection/types/score-projection";
import {
  DASHBOARD_STUDY_PLAN_QUERY_KEY,
  STUDY_PLAN_QUERY_KEY,
  useDashboardStudyPlan,
} from "@/features/study-plan/hooks/use-study-plan";
import { saveStudyPlan } from "@/features/study-plan/api/study-plan";
import {
  defaultSkippedGoalProfileInput,
  hasStudyPlanGoal,
} from "@/features/study-plan/lib/default-study-profile";
import { useStudyPlanTaskActions } from "@/features/study-plan/hooks/use-study-plan-task-actions";
import { useStudyPlanExtraStudyDialog } from "@/features/study-plan/components/study-plan-extra-study";
import { studyPlanActivityTypeLabel } from "@/features/study-plan/lib/activity-type-label";
import { addDays, todayIso } from "@/features/study-plan/lib/dates";
import { allocateSectionTargets } from "@/features/study-plan/lib/section-targets";
import { ContentRatingControls } from "@/features/content-ratings/components/content-rating-controls";
import { contentSnapshotVersion } from "@/features/content-ratings/lib";
import type {
  StudyPlanResponse,
  StudyPlanTask,
} from "@/features/study-plan/model/types";
import {
  UCAT_CARD_CHROME,
  UCAT_FLOATING_GRAPH_CARD,
  UCAT_NEUTRAL_ACTION_HOVER,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";
import { useMediaQuery } from "@/shared/hooks/use-media-query";
import { useUcatInterfacePreferences } from "@/features/interface-preferences/hooks/use-ucat-interface-preferences";

const WEEK_STATUS_LABEL: Record<DashboardWeekSummary["status"], string> = {
  complete: "Complete",
  on_track: "On track",
  adapting: "Plan adapting",
  not_started: "Ready",
};

function sessionTimeLabel(session: StudentUcatSession): string | null {
  if (!session.start_at || !session.end_at) return null;
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Adelaide",
    hour: "numeric",
    minute: "2-digit",
  }).formatRange(new Date(session.start_at), new Date(session.end_at));
}

function findSessionToday(
  sessions: StudentUcatSession[],
  now: Date,
): StudentUcatSession | null {
  const today = todayIso(now);
  return (
    sessions
      .filter(
        (session) =>
          session.start_at && todayIso(new Date(session.start_at)) === today,
      )
      .sort((left, right) => {
        const leftTime = left.start_at ? new Date(left.start_at).getTime() : 0;
        const rightTime = right.start_at
          ? new Date(right.start_at).getTime()
          : 0;
        return leftTime - rightTime;
      })[0] ?? null
  );
}

function TaskTypeIcon({ task }: { task: Pick<StudyPlanTask, "taskType"> }) {
  const Icon: ComponentType<{ className?: string }> =
    task.taskType === "learn"
      ? BookOpen
      : task.taskType === "mock"
        ? NotebookText
        : task.taskType === "section_benchmark"
          ? Gauge
          : task.taskType === "skill_trainer"
            ? Target
            : task.taskType === "review"
              ? RotateCcw
              : BrainCircuit;
  return <Icon className="h-5 w-5" aria-hidden />;
}

function actionIcon(action: DashboardNextAction) {
  switch (action.kind) {
    case "session":
      return <CalendarDays className="h-5 w-5" aria-hidden />;
    case "task":
      return <TaskTypeIcon task={action.task} />;
    case "guidance":
      return <TaskTypeIcon task={action.primary} />;
    case "caught_up":
      return <Check className="h-5 w-5" aria-hidden />;
    case "plan_setup":
      return <CalendarDays className="h-5 w-5" aria-hidden />;
    case "goal_setup":
      return <Target className="h-5 w-5" aria-hidden />;
    case "plan_error":
      return <AlertTriangle className="h-5 w-5" aria-hidden />;
  }
}

function actionContent(action: DashboardNextAction) {
  return describeStudyNextAction(action, {
    sessionTimeLabel:
      action.kind === "session" ? sessionTimeLabel(action.session) : null,
  });
}

function nextActionEyebrow(
  action: DashboardNextAction,
  content: ReturnType<typeof actionContent>,
): string {
  if (action.kind === "task") {
    return `Suggested activity · ${studyPlanActivityTypeLabel(action.task)}`;
  }
  if (action.kind === "guidance") {
    return `Suggested activity · ${studyPlanActivityTypeLabel(action.primary)}`;
  }
  return content.eyebrow;
}

function DashboardNextActionPanel({
  action,
  onStartTask,
  taskPending,
  taskError,
  onRetryPlan,
  onSkipGoal,
  setupPending,
  setupError,
  tourTarget = false,
  guidanceSuggestionsVisible,
}: {
  action: DashboardNextAction;
  onStartTask: () => Promise<void>;
  taskPending: boolean;
  taskError: string | null;
  onRetryPlan: () => void;
  onSkipGoal: () => void | Promise<void>;
  setupPending: boolean;
  setupError: string | null;
  tourTarget?: boolean;
  guidanceSuggestionsVisible: boolean;
}) {
  const content = actionContent(action);
  const eyebrow = nextActionEyebrow(action, content);
  const openExtraStudy = useStudyPlanExtraStudyDialog();
  const handlePrimary = () => {
    if (action.kind === "task") {
      void onStartTask();
      return;
    }
    if (action.kind === "caught_up") {
      openExtraStudy();
      return;
    }
    if (action.kind === "plan_error") onRetryPlan();
  };
  const handleSecondary = () => {
    if (action.kind === "goal_setup") {
      void onSkipGoal();
    }
  };
  const showSecondaryButton =
    content.secondaryLabel && action.kind === "goal_setup";

  return (
    <section
      className="flex flex-col"
      aria-labelledby="dashboard-what-now-title"
      data-tour={tourTarget ? "dashboard-next-step" : undefined}
      data-dashboard-guidance-fallback={
        tourTarget && !guidanceSuggestionsVisible ? "" : undefined
      }
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {eyebrow}
      </p>
      <div className="mt-3 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background text-foreground shadow-sm ring-1 ring-border/60">
          {actionIcon(action)}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="dashboard-what-now-title"
            className="text-lg font-semibold tracking-tight"
          >
            {content.title}
          </h2>
          {content.meta ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              {content.meta}
            </p>
          ) : null}
        </div>
      </div>
      {taskError ? (
        <p className="mt-3 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
          {taskError} Your task remains on the Study plan.
        </p>
      ) : null}
      {setupError ? (
        <p className="mt-3 rounded-xl bg-destructive/10 px-3.5 py-3 text-sm text-destructive">
          {setupError}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {content.primaryHref ? (
          <Button asChild disabled={setupPending}>
            <Link
              href={content.primaryHref}
              data-dashboard-guidance-action={
                tourTarget && !guidanceSuggestionsVisible ? "" : undefined
              }
            >
              {content.primaryLabel}
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            data-dashboard-guidance-action={
              tourTarget && !guidanceSuggestionsVisible ? "" : undefined
            }
            onClick={handlePrimary}
            disabled={taskPending || setupPending}
          >
            {taskPending ? "Starting…" : content.primaryLabel}
            {!taskPending ? (
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
            ) : null}
          </Button>
        )}
        {showSecondaryButton ? (
          <Button
            type="button"
            variant="ghost"
            className={UCAT_NEUTRAL_ACTION_HOVER}
            onClick={handleSecondary}
            disabled={setupPending}
          >
            {setupPending ? "Saving…" : content.secondaryLabel}
          </Button>
        ) : content.secondaryHref && content.secondaryLabel ? (
          <Button asChild variant="ghost" className={UCAT_NEUTRAL_ACTION_HOVER}>
            <Link href={content.secondaryHref}>{content.secondaryLabel}</Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function weakestSectionName(
  sections: SectionScoreProjection[],
  sectionTargets: Record<string, number>,
): { name: string; gap: number } | null {
  return (
    sections
      .filter(
        (section) =>
          section.sectionNumber <= 3 &&
          section.currentEstimate != null &&
          sectionTargets[section.sectionId] != null,
      )
      .map((section) => ({
        name: section.sectionName,
        gap: Math.max(
          0,
          sectionTargets[section.sectionId]! - (section.currentEstimate ?? 0),
        ),
      }))
      .sort((left, right) => right.gap - left.gap)[0] ?? null
  );
}

function recentScoreImprovement(
  snapshots: ScoreProjectionSnapshot[],
  currentEstimate: number | null,
): number | null {
  if (currentEstimate == null || snapshots.length < 2) return null;
  const ordered = [...snapshots].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const latestDate = ordered.at(-1)?.date;
  const cutoff = latestDate ? addDays(latestDate, -60) : "";
  const earliest = ordered.find(
    (snapshot) =>
      snapshot.date >= cutoff && snapshot.currentEstimate !== currentEstimate,
  );
  if (!earliest) return null;
  const change = currentEstimate - earliest.currentEstimate;
  return change >= 20 ? change : null;
}

function dashboardTargetBreakdown(
  sections: SectionScoreProjection[],
  sectionTargets: Record<string, number>,
): DashboardTargetBreakdown[] {
  return sections
    .filter((section) => section.sectionNumber <= 3)
    .sort((left, right) => left.sectionNumber - right.sectionNumber)
    .map((section) => ({
      sectionName: section.sectionName,
      target: sectionTargets[section.sectionId] ?? null,
      currentEstimate: section.currentEstimate,
    }));
}

function DashboardTrajectoryEyebrow({
  testDay,
}: {
  testDay: number | null;
}) {
  const countdown = formatDashboardTestCountdown(testDay);
  return (
    <div
      className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
      data-dashboard-test-countdown={countdown ? "" : undefined}
    >
      {countdown ? <CalendarDays className="size-3.5" aria-hidden /> : null}
      {countdown ?? "Score trajectory"}
    </div>
  );
}

export function DashboardTrajectoryHero({
  firstName,
  plan,
  action,
  state,
  chartData,
  sections,
  snapshots,
  projectionLoading,
  projectionError,
  mocks,
  onStartTask,
  taskPending,
  taskError,
  onRetryPlan,
  onSkipGoal,
  setupPending,
  setupError,
  guidanceSuggestionsVisible = true,
}: {
  firstName: string | null;
  plan: StudyPlanResponse | null | undefined;
  action: DashboardNextAction;
  state: DashboardTrajectoryState | null;
  chartData: ReturnType<typeof buildDashboardTrajectoryChartData>;
  sections: SectionScoreProjection[];
  snapshots: ScoreProjectionSnapshot[];
  projectionLoading: boolean;
  projectionError: boolean;
  mocks: DashboardMockAnnotation[];
  onStartTask: () => Promise<void>;
  taskPending: boolean;
  taskError: string | null;
  onRetryPlan: () => void;
  onSkipGoal: () => void | Promise<void>;
  setupPending: boolean;
  setupError: string | null;
  guidanceSuggestionsVisible?: boolean;
}) {
  const desktopLayout = useMediaQuery("(min-width: 1024px)");
  if (!plan?.profile) {
    const planUnavailable = action.kind === "plan_error";
    const planInsight = buildDashboardPlanInsight({ planUnavailable });
    return (
      <section className="relative isolate -mt-20 overflow-hidden border-b border-border/60 bg-gradient-to-b from-muted/30 via-background to-background pt-20">
        <div className="relative min-h-[520px] sm:min-h-[600px] lg:min-h-[650px]">
          <div
            className="absolute inset-x-0 top-0 z-10 px-5 py-6 sm:px-8 lg:px-10"
          >
            <h1
              data-tour="dashboard-welcome-heading"
              className="text-xl font-semibold tracking-tight sm:text-2xl"
            >
              {firstName ? `Good to see you, ${firstName}` : "Good to see you"}
            </h1>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Your path to test day
            </p>
          </div>
          <div
            id="tour-dashboard-predicted-score"
            className="absolute inset-x-0 top-20 h-[410px] sm:h-[500px] lg:h-[570px]"
          >
            <DashboardTrajectoryChart
              mode="preview"
              targetScore={2100}
              today={todayIso()}
              testDate={null}
              className="h-full"
            />
          </div>
          <aside
            className={cn(
              UCAT_FLOATING_GRAPH_CARD,
              "absolute right-6 top-24 z-20 hidden w-[min(390px,calc(100%-3rem))] p-6 lg:block",
            )}
          >
            <DashboardTrajectoryEyebrow testDay={null} />
            <h2 className="mt-3 text-xl font-semibold tracking-tight">
              {planInsight.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {planInsight.body}
            </p>
            <div className="mt-5 border-t border-border/60 pt-5">
              <DashboardNextActionPanel
                action={action}
                onStartTask={onStartTask}
                taskPending={taskPending}
                taskError={taskError}
                onRetryPlan={onRetryPlan}
                onSkipGoal={onSkipGoal}
                setupPending={setupPending}
                setupError={setupError}
                tourTarget={desktopLayout}
                guidanceSuggestionsVisible={guidanceSuggestionsVisible}
              />
            </div>
          </aside>
        </div>
        <aside
          className={cn(
            UCAT_FLOATING_GRAPH_CARD,
            "relative z-20 mx-4 -mt-16 mb-5 p-5 lg:hidden",
          )}
        >
          <DashboardTrajectoryEyebrow testDay={null} />
          <h2 className="mt-2 text-lg font-semibold">{planInsight.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {planInsight.compactBody}
          </p>
          <div className="mt-4 border-t border-border/60 pt-4">
            <DashboardNextActionPanel
              action={action}
              onStartTask={onStartTask}
              taskPending={taskPending}
              taskError={taskError}
              onRetryPlan={onRetryPlan}
              onSkipGoal={onSkipGoal}
              setupPending={setupPending}
              setupError={setupError}
              tourTarget={!desktopLayout}
              guidanceSuggestionsVisible={guidanceSuggestionsVisible}
            />
          </div>
        </aside>
      </section>
    );
  }

  if (!state) return null;
  const weakestSection = weakestSectionName(
    sections,
    plan.generation?.sectionTargets ?? {},
  );
  const recentImprovement = recentScoreImprovement(
    snapshots,
    state.currentEstimate,
  );
  const insight = buildDashboardTrajectoryInsight({
    projectionUnavailable: projectionError,
    state,
    weakestSection,
    recentImprovement,
    studyPlanEnabled: plan.profile.studyPlanEnabled,
  });
  const displayedInsight = { title: insight.title, body: insight.body };
  const insightRating = (
    <ContentRatingControls
      className="mt-3"
      descriptor={{
        targetType: "dashboard_insight",
        targetKey: insight.ruleId,
        targetVersion: contentSnapshotVersion(displayedInsight),
        contextKey: "dashboard:score-trajectory",
        surface: "dashboard",
        displayedContent: displayedInsight,
      }}
    />
  );
  const targetBreakdown = dashboardTargetBreakdown(
    sections,
    plan.generation?.sectionTargets ??
      allocateSectionTargets({
        totalTarget: plan.profile.targetScore,
        sections: sections
          .filter((section) => section.sectionNumber <= 3)
          .sort((left, right) => left.sectionNumber - right.sectionNumber)
          .map((section) => ({
            sectionId: section.sectionId,
            currentEstimate: section.currentEstimate,
            confidence: section.confidence,
          })),
      }),
  );
  return (
    <section className="relative isolate -mt-20 overflow-hidden border-b border-border/60 bg-gradient-to-b from-muted/25 via-background to-background pt-20">
      <div className="relative min-h-[620px] sm:min-h-[700px] lg:min-h-[690px]">
        <div
          className="absolute inset-x-0 top-0 z-10 px-5 py-6 sm:px-8 lg:px-10"
        >
          <h1
            data-tour="dashboard-welcome-heading"
            className="text-xl font-semibold tracking-tight sm:text-2xl"
          >
            {firstName ? `Good to see you, ${firstName}` : "Good to see you"}
          </h1>
        </div>
        <div
          id="tour-dashboard-predicted-score"
          className="absolute inset-x-0 top-20 min-w-0"
        >
          {projectionLoading ? (
            <Skeleton className="mx-5 h-[410px] rounded-xl sm:mx-8 sm:h-[500px] lg:h-[570px]" />
          ) : projectionError ? (
            <div className="flex h-[410px] items-center justify-center px-6 text-center sm:h-[500px] lg:h-[570px]">
              <div>
                <TrendingUp
                  className="mx-auto size-6 text-muted-foreground"
                  aria-hidden
                />
                <p className="mt-3 text-sm font-medium">
                  Score trajectory unavailable
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your saved goal and next steps are unaffected.
                </p>
              </div>
            </div>
          ) : (
            <DashboardTrajectoryChart
              mode={
                state.stage === "building_baseline" ? "baseline" : "forecast"
              }
              data={chartData}
              targetScore={plan.profile.targetScore}
              currentEstimate={state.currentEstimate}
              today={plan.today}
              testDate={plan.profile.testDate}
              showTestMarker={state.projectedAtTest != null}
              mocks={mocks}
              targetBreakdown={targetBreakdown}
              className="h-[410px] sm:h-[500px] lg:h-[570px]"
            />
          )}
        </div>
        <aside
          className={cn(
            UCAT_FLOATING_GRAPH_CARD,
            "absolute right-6 top-24 z-20 hidden w-[min(390px,calc(100%-3rem))] p-6 lg:block",
          )}
        >
          <section aria-labelledby="dashboard-why-title">
            <DashboardTrajectoryEyebrow testDay={state.testDay} />
            <h2 id="dashboard-why-title" className="mt-3 text-lg font-semibold">
              {insight.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {insight.body}
            </p>
            {insightRating}
            {insight.actionHref && insight.actionLabel ? (
              <Link
                href={insight.actionHref}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {insight.actionLabel}
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            ) : null}
          </section>
          <div className="mt-5 border-t border-border/60 pt-5">
            <DashboardNextActionPanel
              action={action}
              onStartTask={onStartTask}
              taskPending={taskPending}
              taskError={taskError}
              onRetryPlan={onRetryPlan}
              onSkipGoal={onSkipGoal}
              setupPending={setupPending}
              setupError={setupError}
              tourTarget={desktopLayout}
              guidanceSuggestionsVisible={guidanceSuggestionsVisible}
            />
          </div>
        </aside>
      </div>
      <aside
        className={cn(
          UCAT_FLOATING_GRAPH_CARD,
          "relative z-20 mx-4 -mt-20 mb-5 p-5 lg:hidden",
        )}
      >
        <section aria-labelledby="dashboard-why-title-mobile">
          <DashboardTrajectoryEyebrow testDay={state.testDay} />
          <h2
            id="dashboard-why-title-mobile"
            className="mt-2 text-lg font-semibold"
          >
            {insight.title}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">{insight.body}</p>
          {insightRating}
          {insight.actionHref && insight.actionLabel ? (
            <Link
              href={insight.actionHref}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {insight.actionLabel}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          ) : null}
        </section>
        <div className="mt-4 border-t border-border/60 pt-4">
          <DashboardNextActionPanel
            action={action}
            onStartTask={onStartTask}
            taskPending={taskPending}
            taskError={taskError}
            onRetryPlan={onRetryPlan}
            onSkipGoal={onSkipGoal}
            setupPending={setupPending}
            setupError={setupError}
            tourTarget={!desktopLayout}
            guidanceSuggestionsVisible={guidanceSuggestionsVisible}
          />
        </div>
      </aside>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums text-right">
        {value}
      </span>
    </div>
  );
}

export function DashboardWeekProgress({
  week,
  sessionToday,
  samplerDecided,
  samplerCompleted,
}: {
  week: DashboardWeekSummary | null;
  sessionToday: StudentUcatSession | null;
  samplerDecided: boolean;
  samplerCompleted: boolean;
}) {
  if (!week) {
    const activationPercent = samplerCompleted ? 25 : 0;
    return (
      <section
        aria-labelledby="dashboard-foundation-title"
        className="space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="dashboard-foundation-title" className="font-semibold">
            {samplerDecided ? "Your first steps" : "Your week"}
          </h2>
          <Badge variant="secondary">
            {samplerDecided ? `${samplerCompleted ? 1 : 0} of 4` : "Ready"}
          </Badge>
        </div>
        {samplerDecided ? (
          <>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={activationPercent}
              aria-label={`${activationPercent}% of activation milestones complete`}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{ width: `${activationPercent}%` }}
              />
            </div>
            <SummaryRow
              label="Sample questions"
              value={samplerCompleted ? "Complete" : "Next"}
            />
            <SummaryRow
              label="Personalised plan"
              value={samplerCompleted ? "Next" : "After sample questions"}
            />
            <SummaryRow label="First real review" value="Later" />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Build a Study plan to turn your target and availability into a clear
            weekly path.
          </p>
        )}
      </section>
    );
  }

  const progressLabel = week.totalTasks
    ? `${week.completedTasks} of ${week.totalTasks} tasks complete`
    : "No Study plan tasks this week";
  const sessionLabel = sessionToday ? sessionTimeLabel(sessionToday) : null;

  return (
    <section aria-labelledby="dashboard-week-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="dashboard-week-title" className="font-semibold">
          This week
        </h2>
        <Badge variant="secondary">{WEEK_STATUS_LABEL[week.status]}</Badge>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={week.percent}
        aria-label={progressLabel}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${week.percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">{progressLabel}</p>
      <div>
        <SummaryRow
          label="Focused time"
          value={`${week.completedMinutes} / ${week.totalMinutes} min`}
        />
        {sessionToday && sessionLabel ? (
          <SummaryRow label="UCAT session" value={sessionLabel} />
        ) : (
          <SummaryRow
            label="Next study day"
            value={
              week.nextStudyDate
                ? formatDashboardDate(week.nextStudyDate)
                : "Plan complete"
            }
          />
        )}
      </div>
    </section>
  );
}

function dashboardMockAnnotations(
  plan: StudyPlanResponse | null | undefined,
): DashboardMockAnnotation[] {
  if (!plan?.profile) return [];
  const startsOn = addDays(plan.today, -60);
  const endsOn = addDays(plan.today, 120);
  return plan.tasks
    .filter(
      (task) =>
        task.taskType === "mock" &&
        task.status !== "skipped" &&
        task.scheduledDate >= startsOn &&
        task.scheduledDate <= endsOn,
    )
    .sort((left, right) =>
      left.scheduledDate.localeCompare(right.scheduledDate),
    )
    .slice(0, 6)
    .map((task, index) => ({
      date: task.scheduledDate,
      label: `M${index + 1}`,
      title: task.title,
      completed: task.status === "completed",
    }));
}

export function DashboardHome() {
  const profileQuery = useUcatProfile();
  const { preferences } = useUcatInterfacePreferences();
  const planQuery = useDashboardStudyPlan();
  const queryClient = useQueryClient();
  const scoreProjectionQuery = useScoreProjection(
    Boolean(planQuery.data?.profile),
  );
  const sessionsQuery = useStudentUcatSessions();
  const onboarding = useOnboardingProgress();
  const [now, setNow] = useState(() => new Date());
  const [setupPending, setSetupPending] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const samplerDecided = onboarding.isCompleted(UCAT_GUIDED_SAMPLER_DECIDED);
  const samplerCompleted = onboarding.isCompleted(
    UCAT_GUIDED_SAMPLER_COMPLETED,
  );
  const studyPlanDecided = onboarding.isCompleted(UCAT_STUDY_PLAN_DECIDED);
  const hasGoal = hasStudyPlanGoal(planQuery.data?.profile);
  const sessions = useMemo(
    () => sessionsQuery.data ?? [],
    [sessionsQuery.data],
  );
  const action = useMemo(
    () =>
      resolveDashboardNextAction({
        now,
        sessions,
        plan: planQuery.data,
        planLoadFailed: planQuery.isError,
        studyPlanDecided,
        hasGoal,
      }),
    [
      hasGoal,
      now,
      planQuery.data,
      planQuery.isError,
      sessions,
      studyPlanDecided,
    ],
  );

  async function handleSkipGoal() {
    setSetupPending(true);
    setSetupError(null);
    try {
      const nextPlan = await saveStudyPlan(defaultSkippedGoalProfileInput());
      queryClient.setQueryData(DASHBOARD_STUDY_PLAN_QUERY_KEY, nextPlan);
      queryClient.setQueryData(STUDY_PLAN_QUERY_KEY, nextPlan);
      await queryClient.invalidateQueries({
        queryKey: STUDY_PLAN_QUERY_KEY,
      });
    } catch (caught) {
      setSetupError(
        caught instanceof Error
          ? caught.message
          : "Could not continue without a goal.",
      );
    } finally {
      setSetupPending(false);
    }
  }
  const nextTask = action.kind === "task" ? action.task : null;
  const taskActions = useStudyPlanTaskActions(
    nextTask,
    true,
    planQuery.data ?? null,
  );
  const week = useMemo(
    () =>
      planQuery.data?.profile?.studyPlanEnabled
        ? summarizeDashboardWeek(planQuery.data)
        : null,
    [planQuery.data],
  );
  const sessionToday = useMemo(
    () => findSessionToday(sessions, now),
    [now, sessions],
  );
  const totalProjection = useMemo(
    () =>
      scoreProjectionQuery.data
        ? deriveTotalScoreProjection(scoreProjectionQuery.data.sections)
        : null,
    [scoreProjectionQuery.data],
  );
  const trajectoryState = useMemo(() => {
    const plan = planQuery.data;
    if (!plan?.profile) return null;
    return resolveDashboardTrajectory({
      today: plan.today,
      targetScore: plan.profile.targetScore,
      testDate: plan.profile.testDate,
      total: totalProjection,
      sections: scoreProjectionQuery.data?.sections ?? [],
    });
  }, [planQuery.data, scoreProjectionQuery.data?.sections, totalProjection]);
  const chartData = useMemo(
    () =>
      totalProjection?.currentEstimate != null
        ? buildDashboardTrajectoryChartData(
            totalProjection,
            planQuery.data?.today ?? todayIso(),
            trajectoryState?.projectedAtTest,
            scoreProjectionQuery.data?.snapshots ?? [],
          )
        : [],
    [
      planQuery.data?.today,
      scoreProjectionQuery.data?.snapshots,
      totalProjection,
      trajectoryState?.projectedAtTest,
    ],
  );
  const mockAnnotations = useMemo(
    () => dashboardMockAnnotations(planQuery.data),
    [planQuery.data],
  );
  const { containerVariants, itemVariants } = useUcatStaggerMotion();

  if (
    planQuery.isLoading ||
    (onboarding.isLoading && !planQuery.data?.profile)
  ) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-[650px] w-full" />
        <div className="mx-auto grid w-full max-w-[1400px] gap-5 px-5 sm:px-6 lg:grid-cols-3">
          <Skeleton className="h-64 rounded-ucatShell" />
          <Skeleton className="h-64 rounded-ucatShell" />
          <Skeleton className="h-64 rounded-ucatShell" />
        </div>
      </div>
    );
  }

  const firstName = profileQuery.data?.firstName?.trim() || null;
  const plan = planQuery.data;

  return (
    <motion.div
      className="space-y-6 pb-8"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <DashboardTrajectoryHero
          firstName={firstName}
          plan={plan}
          action={action}
          state={trajectoryState}
          chartData={chartData}
          sections={scoreProjectionQuery.data?.sections ?? []}
          snapshots={scoreProjectionQuery.data?.snapshots ?? []}
          projectionLoading={scoreProjectionQuery.isLoading}
          projectionError={scoreProjectionQuery.isError}
          mocks={mockAnnotations}
          onStartTask={taskActions.startTask}
          taskPending={taskActions.pendingAction === "start"}
          taskError={taskActions.error}
          onRetryPlan={() => void planQuery.refetch()}
          onSkipGoal={handleSkipGoal}
          setupPending={setupPending}
          setupError={setupError}
          guidanceSuggestionsVisible={preferences.studySuggestionsVisible}
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="mx-auto grid w-full max-w-[1400px] grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-5 px-5 sm:px-6"
      >
        <DashboardActivationChecklist />
        {plan?.profile?.studyPlanEnabled ? (
          <Card
            data-tour="dashboard-week-card"
            className={cn(UCAT_CARD_CHROME, "h-full")}
          >
            <CardContent className="p-5 sm:p-6">
              <DashboardWeekProgress
                week={week}
                sessionToday={sessionToday}
                samplerDecided={samplerDecided}
                samplerCompleted={samplerCompleted}
              />
            </CardContent>
          </Card>
        ) : null}
        <Card
          data-tour="dashboard-membership-card"
          className={cn(UCAT_CARD_CHROME, "h-full")}
        >
          <CardContent className="p-5 sm:p-6">
            <DashboardMembershipValue nextTask={nextTask} />
          </CardContent>
        </Card>
        <DashboardRecentAttemptsCard />
      </motion.div>

      {planQuery.data?.generation?.capacityRisk.level === "warning" ? (
        <motion.div variants={itemVariants}>
          <Card
            className={cn(
              UCAT_CARD_CHROME,
              "mx-5 sm:mx-6 lg:mx-auto lg:w-[calc(100%-3rem)] lg:max-w-[1352px]",
            )}
          >
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Worth knowing
                  </p>
                  <h2 className="mt-1 font-semibold">
                    Your available time is tight
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {planQuery.data.generation.capacityRisk.message} Your plan
                    is already choosing the highest-value work within that
                    limit.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="shrink-0">
                <Link href="/settings/study-plan">Adjust availability</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : null}
    </motion.div>
  );
}
