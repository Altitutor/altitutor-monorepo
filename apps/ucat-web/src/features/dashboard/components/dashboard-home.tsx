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

function actionContent(action: DashboardNextAction): {
  eyebrow: string;
  title: string;
  description: string;
  rationale: string | null;
  meta: string | null;
  primaryLabel: string;
  primaryHref: string | null;
  secondaryLabel: string | null;
  secondaryHref: string | null;
} {
  switch (action.kind) {
    case "session": {
      const time = sessionTimeLabel(action.session);
      return {
        eyebrow: action.live ? "Live now" : "Starting soon",
        title: action.live
          ? "Join your UCAT session"
          : "Your UCAT session is next",
        description: action.session.class_level
          ? `${action.session.class_level} session with your class.`
          : "Your tutor-led UCAT session is ready when you are.",
        rationale: action.live
          ? "Your session takes priority over independent Study plan work."
          : "We’ll keep your independent task waiting until after the session.",
        meta: time,
        primaryLabel: action.live ? "Join session" : "View session",
        primaryHref: `/sessions/${encodeURIComponent(action.session.session_id)}`,
        secondaryLabel: null,
        secondaryHref: null,
      };
    }
    case "task":
      return {
        eyebrow: action.fromEarlierStudyDay
          ? "Still to do"
          : action.task.taskType === "review"
            ? "Most useful now"
            : "Next up",
        title: action.task.title,
        description: action.task.description,
        rationale: action.fromEarlierStudyDay
          ? "This was planned for an earlier study day. Finish it now, or open your Study plan to skip it without losing the rest of today’s direction."
          : action.task.rationale || null,
        meta: `About ${action.task.estimatedMinutes} min`,
        primaryLabel:
          action.task.status === "in_progress" ||
          action.task.status === "partial"
            ? "Continue task"
            : action.task.taskType === "review"
              ? "Review result"
              : "Start today’s task",
        primaryHref: null,
        secondaryLabel: "Open Study plan",
        secondaryHref: "/study-plan",
      };
    case "guidance":
      return {
        eyebrow:
          action.primary.taskType === "review"
            ? "Most useful now"
            : "Best next step",
        title: action.primary.title,
        description: action.primary.description,
        rationale: action.primary.rationale || null,
        meta: `About ${action.primary.estimatedMinutes} min`,
        primaryLabel:
          action.primary.taskType === "review" ? "Review result" : "Start",
        primaryHref: action.primary.launchPath,
        secondaryLabel: null,
        secondaryHref: null,
      };
    case "caught_up":
      return {
        eyebrow: action.hadTasksToday ? "Today’s work" : "Today",
        title: action.hadTasksToday
          ? "Today’s Study plan is complete"
          : "Today is a rest day",
        description: action.hadTasksToday
          ? "You’ve completed everything the plan asked of you today."
          : "There’s no planned work today. Rest is already part of your preparation.",
        rationale: action.nextStudyDate
          ? `Your next planned study block is ${formatDashboardDate(action.nextStudyDate)}.`
          : "Your plan has no further scheduled work right now.",
        meta: null,
        primaryLabel: action.hadTasksToday
          ? "I have time for more"
          : "I’d like to study today",
        primaryHref: null,
        secondaryLabel: "View Study plan",
        secondaryHref: "/study-plan",
      };
    case "plan_setup":
      return {
        eyebrow: "Your next step",
        title: "Organise your study with a Study plan",
        description:
          "Altitutor can schedule adaptive work around your availability and adjust it as your performance changes.",
        rationale:
          "A Study plan gives you a clearer weekly path based on your goal and availability.",
        meta: "About 3 min to set up",
        primaryLabel: "Set up Study plan",
        primaryHref: "/study-plan/setup?section=plan",
        secondaryLabel: null,
        secondaryHref: null,
      };
    case "goal_setup":
      return {
        eyebrow: "Your next step",
        title: "Set your UCAT year and target score",
        description:
          "Give your dashboard a clear destination before you continue with suggested study activities.",
        rationale:
          "Your target is a working direction, not a prediction. You can change it at any time.",
        meta: "UCAT year · working target",
        primaryLabel: "Set my goal",
        primaryHref: "/ucat-goal/setup",
        secondaryLabel: "Skip for now",
        secondaryHref: null,
      };
    case "plan_error":
      return {
        eyebrow: "Study plan unavailable",
        title: "We couldn’t load your next step",
        description: "Your existing Study plan has not been changed.",
        rationale: "Try loading it again before starting unrelated work.",
        meta: null,
        primaryLabel: "Try again",
        primaryHref: null,
        secondaryLabel: null,
        secondaryHref: null,
      };
  }
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
}: {
  action: DashboardNextAction;
  onStartTask: () => Promise<void>;
  taskPending: boolean;
  taskError: string | null;
  onRetryPlan: () => void;
  onSkipGoal: () => void | Promise<void>;
  setupPending: boolean;
  setupError: string | null;
}) {
  const content = actionContent(action);
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
    >
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Suggested next step
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
            <Link href={content.primaryHref}>
              {content.primaryLabel}
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
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

function trajectoryInsight(
  state: DashboardTrajectoryState,
  weakestSection: { name: string; gap: number } | null,
  recentImprovement: number | null,
  studyPlanEnabled: boolean,
): { title: string; body: string; actionLabel?: string; actionHref?: string } {
  switch (state.stage) {
    case "building_baseline": {
      const missing = new Intl.ListFormat("en-AU", {
        style: "long",
        type: "conjunction",
      }).format(state.missingSectionNames);
      return {
        title: "First, establish where you’re starting",
        body: missing
          ? `${state.readySectionCount} of Sections 1–3 are ready. Timed evidence in ${missing} will unlock your total trajectory.`
          : "Complete more timed sets or mocks to unlock a trustworthy total trajectory.",
      };
    }
    case "early_estimate":
      return {
        title: "Your direction is forming—not fixed",
        body: "Your first estimate has a wide range. More timed evidence will narrow it before we judge whether your target is on track.",
      };
    case "no_test_date":
      return {
        title: `This is a ${state.forecastHorizonDays}-day outlook`,
        body: "We'll be able to better predict your score trajectory once we have an exact test date.",
      };
    case "long_range":
      return {
        title: "Your test is beyond the reliable forecast window",
        body: `We’re showing the next ${state.forecastHorizonDays} days instead of inventing an exam-day score. The forecast will become more useful as your test approaches.`,
      };
    case "on_track":
      return {
        title: recentImprovement
          ? `Your estimate is up ${recentImprovement} points`
          : "Your current path supports the target",
        body: weakestSection
          ? `${weakestSection.name} still has the largest section gap at ${weakestSection.gap} points below its Study plan target, so today’s work keeps focus there.`
          : studyPlanEnabled
            ? "Keep following today’s Study plan so new evidence can confirm the direction."
            : "Keep using your next steps to add evidence and confirm the direction.",
      };
    case "within_reach":
      return {
        title: recentImprovement
          ? `You’re trending upward by ${recentImprovement} points`
          : "Your target sits inside the plausible range",
        body: weakestSection
          ? `${weakestSection.name} is ${weakestSection.gap} points below its section target. Today’s work is designed to improve the evidence behind that range.`
          : "Today’s work is designed to move the likely path upward and narrow the uncertainty.",
      };
    case "needs_adjustment":
      if (
        state.projectedAtTest &&
        state.targetScore - state.projectedAtTest.optimistic >= 150
      ) {
        return {
          title: "This target is very unlikely on the current timeline",
          body: `Even the optimistic range reaches ${state.projectedAtTest.optimistic}, which remains ${state.targetScore - state.projectedAtTest.optimistic} points below your target. Consider moving your test date or setting a more achievable target.`,
          actionLabel: "Adjust target or test date",
          actionHref: "/settings/study-plan",
        };
      }
      return {
        title: "Your current evidence suggests a gap",
        body: weakestSection
          ? `${weakestSection.name} is furthest from its section target at ${weakestSection.gap} points below it. Start with today’s next step and keep building evidence.`
          : studyPlanEnabled
            ? "Start with today’s next step. Your Study plan will keep adapting as new evidence arrives."
            : "Start with today’s next step. Altitutor will adapt the following choice as new evidence arrives.",
      };
  }
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
}) {
  if (!plan?.profile) {
    const planUnavailable = action.kind === "plan_error";
    return (
      <section className="relative isolate -mt-20 overflow-hidden border-b border-border/60 bg-gradient-to-b from-muted/30 via-background to-background pt-20">
        <div className="relative min-h-[520px] sm:min-h-[600px] lg:min-h-[650px]">
          <div className="absolute inset-x-0 top-0 z-10 px-5 py-6 sm:px-8 lg:px-10">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {firstName ? `Good to see you, ${firstName}` : "Good to see you"}
            </h1>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Your path to test day
            </p>
          </div>
          <DashboardTrajectoryChart
            mode="preview"
            targetScore={2100}
            today={todayIso()}
            testDate={null}
            className="absolute inset-x-0 top-20 h-[410px] sm:h-[500px] lg:h-[570px]"
          />
          <aside
            className={cn(
              UCAT_FLOATING_GRAPH_CARD,
              "absolute right-6 top-24 z-20 hidden w-[min(390px,calc(100%-3rem))] p-6 lg:block",
            )}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Your predicted score trajectory
            </p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight">
              {planUnavailable
                ? "We couldn’t load your Study plan"
                : "A goal needs a path"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {planUnavailable
                ? "Your existing plan has not been changed. Reload it before starting unrelated work."
                : "Add your target score and test date so Altitutor UCAT can estimate where you stand and show how your trajectory changes."}
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
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Your predicted score trajectory
          </p>
          <h2 className="mt-2 text-lg font-semibold">
            {planUnavailable
              ? "We couldn’t load your Study plan"
              : "A goal needs a path"}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {planUnavailable
              ? "Your existing plan has not been changed. Reload it before starting unrelated work."
              : "Build a Study plan to replace this preview with your target and real evidence."}
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
  const insight = projectionError
    ? {
        title: "Your projection is temporarily unavailable",
        body: "Your next step is still available while we reload the score evidence.",
      }
    : trajectoryInsight(
        state,
        weakestSection,
        recentImprovement,
        plan.profile.studyPlanEnabled,
      );
  const displayedInsight = { title: insight.title, body: insight.body };
  const insightRating = (
    <ContentRatingControls
      className="mt-3"
      descriptor={{
        targetType: "dashboard_insight",
        targetKey: `score-trajectory:${projectionError ? "unavailable" : state.stage}`,
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
      allocateSectionTargets(
        plan.profile.targetScore,
        sections
          .filter((section) => section.sectionNumber <= 3)
          .sort((left, right) => left.sectionNumber - right.sectionNumber)
          .map((section) => ({
            sectionId: section.sectionId,
            currentEstimate: section.currentEstimate,
          })),
      ),
  );
  return (
    <section className="relative isolate -mt-20 overflow-hidden border-b border-border/60 bg-gradient-to-b from-muted/25 via-background to-background pt-20">
      <div className="relative min-h-[620px] sm:min-h-[700px] lg:min-h-[690px]">
        <div className="absolute inset-x-0 top-0 z-10 px-5 py-6 sm:px-8 lg:px-10">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {firstName ? `Good to see you, ${firstName}` : "Good to see you"}
          </h1>
        </div>
        <div className="absolute inset-x-0 top-20 min-w-0">
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
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Your predicted score trajectory
            </div>
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
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Your predicted score trajectory
          </div>
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
        />
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="mx-auto grid w-full max-w-[1400px] grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-5 px-5 sm:px-6"
      >
        <DashboardActivationChecklist />
        {plan?.profile?.studyPlanEnabled ? (
          <Card className={cn(UCAT_CARD_CHROME, "h-full")}>
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
        <Card className={cn(UCAT_CARD_CHROME, "h-full")}>
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
