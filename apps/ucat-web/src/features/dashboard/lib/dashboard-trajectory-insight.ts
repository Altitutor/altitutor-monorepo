import type { DashboardTrajectoryState } from "./dashboard-trajectory";

export const DASHBOARD_TRAJECTORY_INSIGHT_RULE_IDS = [
  "dashboard_trajectory.projection_unavailable",
  "dashboard_trajectory.building_baseline",
  "dashboard_trajectory.early_estimate",
  "dashboard_trajectory.bounded_outlook_improving",
  "dashboard_trajectory.bounded_outlook_section_gap",
  "dashboard_trajectory.no_test_date",
  "dashboard_trajectory.long_range",
  "dashboard_trajectory.on_track",
  "dashboard_trajectory.on_track_improving",
  "dashboard_trajectory.within_reach",
  "dashboard_trajectory.within_reach_improving",
  "dashboard_trajectory.target_very_unlikely",
  "dashboard_trajectory.needs_adjustment",
] as const;

export type DashboardTrajectoryInsightRuleId =
  (typeof DASHBOARD_TRAJECTORY_INSIGHT_RULE_IDS)[number];

export type DashboardTrajectoryInsight = {
  ruleId: DashboardTrajectoryInsightRuleId;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
};

export type DashboardTrajectoryInsightInput = {
  projectionUnavailable?: boolean;
  state: DashboardTrajectoryState;
  weakestSection: { name: string; gap: number } | null;
  recentImprovement: number | null;
  studyPlanEnabled: boolean;
};

function positiveSectionGap(
  weakestSection: { name: string; gap: number } | null,
): { name: string; gap: number } | null {
  return weakestSection && weakestSection.gap > 0 ? weakestSection : null;
}

function largestStudyPlanSectionGapBody(section: {
  name: string;
  gap: number;
}): string {
  return `${section.name} still has the largest section gap at ${section.gap} points below its Study plan target, so today’s work keeps focus there.`;
}

function buildBoundedOutlookInsight({
  fallback,
  weakestSection,
  recentImprovement,
  studyPlanEnabled,
}: {
  fallback: DashboardTrajectoryInsight;
  weakestSection: { name: string; gap: number } | null;
  recentImprovement: number | null;
  studyPlanEnabled: boolean;
}): DashboardTrajectoryInsight {
  const gap = positiveSectionGap(weakestSection);
  if (recentImprovement) {
    return {
      ruleId: "dashboard_trajectory.bounded_outlook_improving",
      title: `Your estimate is up ${recentImprovement} points`,
      body: gap
        ? largestStudyPlanSectionGapBody(gap)
        : studyPlanEnabled
          ? "Keep following today's Study plan. More timed practice will keep this estimate moving."
          : "Keep using your next steps. More timed practice will keep this estimate moving.",
    };
  }
  if (gap) {
    return {
      ruleId: "dashboard_trajectory.bounded_outlook_section_gap",
      title: `${gap.name} still has the largest section gap`,
      body: `It's ${gap.gap} points below its Study plan target. Start with today's next step and keep practising.`,
    };
  }
  return fallback;
}

export function buildDashboardTrajectoryInsight({
  projectionUnavailable = false,
  state,
  weakestSection,
  recentImprovement,
  studyPlanEnabled,
}: DashboardTrajectoryInsightInput): DashboardTrajectoryInsight {
  if (projectionUnavailable) {
    return {
      ruleId: "dashboard_trajectory.projection_unavailable",
      title: "Your score projection is temporarily unavailable",
      body: "Your next step is still available while we reload your score estimate.",
    };
  }

  switch (state.stage) {
    case "building_baseline": {
      if (state.missingSectionNames.length === 0) {
        return {
          ruleId: "dashboard_trajectory.building_baseline",
          title: "Your score estimate is being built",
          body: "Complete more timed practice across the cognitive sections to build a reliable estimate.",
        };
      }
      const missing = new Intl.ListFormat("en-AU", {
        style: "long",
        type: "conjunction",
      }).format(state.missingSectionNames);
      return {
        ruleId: "dashboard_trajectory.building_baseline",
        title: "Your score estimate is being built",
        body: `You haven't completed enough questions to get a reliable estimate yet. Complete more timed practice in ${missing}.`,
      };
    }
    case "early_estimate":
      return {
        ruleId: "dashboard_trajectory.early_estimate",
        title: "An early score estimate is available",
        body: "Your score estimate has a wide range. More timed practice will make it more accurate and allow us to generate a score projection.",
      };
    case "no_test_date":
      return buildBoundedOutlookInsight({
        weakestSection,
        recentImprovement,
        studyPlanEnabled,
        fallback: {
          ruleId: "dashboard_trajectory.no_test_date",
          title: "This is a 120-day outlook",
          body: `An exact test date isn't booked yet, so this chart shows the next ${state.forecastHorizonDays} days rather than exam day. Keep following today's work.`,
        },
      });
    case "long_range":
      return buildBoundedOutlookInsight({
        weakestSection,
        recentImprovement,
        studyPlanEnabled,
        fallback: {
          ruleId: "dashboard_trajectory.long_range",
          title: "Your test is beyond the reliable forecast window",
          body: `Your score projection shows the next ${state.forecastHorizonDays} days. We'll judge exam-day progress once your test is inside that window. Keep following today's work.`,
        },
      });
    case "on_track":
      return {
        ruleId: recentImprovement
          ? "dashboard_trajectory.on_track_improving"
          : "dashboard_trajectory.on_track",
        title: recentImprovement
          ? `Your estimate is up ${recentImprovement} points`
          : "Even your low-end projection meets your target",
        body: weakestSection
          ? largestStudyPlanSectionGapBody(weakestSection)
          : studyPlanEnabled
            ? "Keep following today’s Study plan so more practice can confirm that you’re on track."
            : "Keep using your next steps to practice more and confirm that you’re on track.",
      };
    case "within_reach":
      return {
        ruleId: recentImprovement
          ? "dashboard_trajectory.within_reach_improving"
          : "dashboard_trajectory.within_reach",
        title: recentImprovement
          ? `You’re trending upward by ${recentImprovement} points`
          : "Your target sits inside your projected score range",
        body: weakestSection
          ? `${weakestSection.name} is ${weakestSection.gap} points below its section target. Today’s work is designed to make that estimate more reliable.`
          : "Today’s work is designed to lift your projected score and narrow the range.",
      };
    case "needs_adjustment":
      if (
        state.projectedAtTest &&
        state.targetScore - state.projectedAtTest.optimistic >= 150
      ) {
        return {
          ruleId: "dashboard_trajectory.target_very_unlikely",
          title: "This target is very unlikely on the current timeline",
          body: `Even the best-case projection reaches ${state.projectedAtTest.optimistic}, which remains ${state.targetScore - state.projectedAtTest.optimistic} points below your target. Consider moving your test date or setting a more achievable target.`,
          actionLabel: "Adjust target or test date",
          actionHref: "/settings/study-plan",
        };
      }
      return {
        ruleId: "dashboard_trajectory.needs_adjustment",
        title: "Your current projection suggests a gap",
        body: weakestSection
          ? `${weakestSection.name} is furthest from its section target at ${weakestSection.gap} points below it. Start with today’s next step and keep practising.`
          : studyPlanEnabled
            ? "Start with today’s next step. Your Study plan will keep adapting as you practice."
            : "Start with today’s next step. Altitutor will adapt the following choice as your results update.",
      };
  }
}
