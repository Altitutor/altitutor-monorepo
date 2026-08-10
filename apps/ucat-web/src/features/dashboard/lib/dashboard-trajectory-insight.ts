import type { DashboardTrajectoryState } from "./dashboard-trajectory";

export const DASHBOARD_TRAJECTORY_INSIGHT_RULE_IDS = [
  "dashboard_trajectory.projection_unavailable",
  "dashboard_trajectory.building_baseline",
  "dashboard_trajectory.early_estimate",
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
      title: "Your projection is temporarily unavailable",
      body: "Your next step is still available while we reload the score evidence.",
    };
  }

  switch (state.stage) {
    case "building_baseline": {
      const missing = new Intl.ListFormat("en-AU", {
        style: "long",
        type: "conjunction",
      }).format(state.missingSectionNames);
      return {
        ruleId: "dashboard_trajectory.building_baseline",
        title: "First, establish where you’re starting",
        body: missing
          ? `${state.readySectionCount} of Sections 1–3 are ready. Timed evidence in ${missing} will unlock your total trajectory.`
          : "Complete more timed sets or mocks to unlock a trustworthy total trajectory.",
      };
    }
    case "early_estimate":
      return {
        ruleId: "dashboard_trajectory.early_estimate",
        title: "Your direction is forming—not fixed",
        body: "Your first estimate has a wide range. More timed evidence will narrow it before we judge whether your target is on track.",
      };
    case "no_test_date":
      return {
        ruleId: "dashboard_trajectory.no_test_date",
        title: `This is a ${state.forecastHorizonDays}-day outlook`,
        body: "We'll be able to better predict your score trajectory once we have an exact test date.",
      };
    case "long_range":
      return {
        ruleId: "dashboard_trajectory.long_range",
        title: "Your test is beyond the reliable forecast window",
        body: `We’re showing the next ${state.forecastHorizonDays} days instead of inventing an exam-day score. The forecast will become more useful as your test approaches.`,
      };
    case "on_track":
      return {
        ruleId: recentImprovement
          ? "dashboard_trajectory.on_track_improving"
          : "dashboard_trajectory.on_track",
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
        ruleId: recentImprovement
          ? "dashboard_trajectory.within_reach_improving"
          : "dashboard_trajectory.within_reach",
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
          ruleId: "dashboard_trajectory.target_very_unlikely",
          title: "This target is very unlikely on the current timeline",
          body: `Even the optimistic range reaches ${state.projectedAtTest.optimistic}, which remains ${state.targetScore - state.projectedAtTest.optimistic} points below your target. Consider moving your test date or setting a more achievable target.`,
          actionLabel: "Adjust target or test date",
          actionHref: "/settings/study-plan",
        };
      }
      return {
        ruleId: "dashboard_trajectory.needs_adjustment",
        title: "Your current evidence suggests a gap",
        body: weakestSection
          ? `${weakestSection.name} is furthest from its section target at ${weakestSection.gap} points below it. Start with today’s next step and keep building evidence.`
          : studyPlanEnabled
            ? "Start with today’s next step. Your Study plan will keep adapting as new evidence arrives."
            : "Start with today’s next step. Altitutor will adapt the following choice as new evidence arrives.",
      };
  }
}
