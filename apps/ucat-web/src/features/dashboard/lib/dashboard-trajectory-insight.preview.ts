import type { InsightPreviewCase } from "@/features/insights/model/insight-preview";
import type { DashboardTrajectoryState } from "./dashboard-trajectory";
import type {
  DashboardTrajectoryInsightInput,
  DashboardTrajectoryInsightRuleId,
} from "./dashboard-trajectory-insight";

function state(
  stage: DashboardTrajectoryState["stage"],
  overrides: Partial<DashboardTrajectoryState> = {},
): DashboardTrajectoryState {
  return {
    stage,
    currentEstimate: stage === "building_baseline" ? null : 2100,
    confidence: stage === "early_estimate" ? "low" : "medium",
    targetScore: 2300,
    testDay: 80,
    forecastHorizonDays: 120,
    forecastPoint: null,
    projectedAtTest: {
      day: 80,
      date: "2026-10-29",
      pessimistic: 2200,
      realistic: 2300,
      optimistic: 2400,
    },
    readySectionCount: stage === "building_baseline" ? 1 : 3,
    missingSectionNames:
      stage === "building_baseline"
        ? ["Decision Making", "Quantitative Reasoning"]
        : [],
    ...overrides,
  };
}

const BASE_INPUT = {
  weakestSection: { name: "Verbal Reasoning", gap: 80 },
  recentImprovement: null,
  studyPlanEnabled: true,
};

export const DASHBOARD_TRAJECTORY_INSIGHT_PREVIEW_CASES = [
  {
    label: "Projection unavailable",
    condition:
      "The Study plan is available but score projection evidence failed to load.",
    input: {
      ...BASE_INPUT,
      state: state("early_estimate"),
      projectionUnavailable: true,
    },
    expectedRuleId: "dashboard_trajectory.projection_unavailable",
  },
  {
    label: "Building baseline",
    condition: "Fewer than all three cognitive sections have usable estimates.",
    input: { ...BASE_INPUT, state: state("building_baseline") },
    expectedRuleId: "dashboard_trajectory.building_baseline",
  },
  {
    label: "Early estimate",
    condition: "A total estimate exists but projection confidence is low.",
    input: { ...BASE_INPUT, state: state("early_estimate") },
    expectedRuleId: "dashboard_trajectory.early_estimate",
  },
  {
    label: "No exact test date",
    condition: "Confidence is usable but no exact UCAT test date is stored.",
    input: { ...BASE_INPUT, state: state("no_test_date", { testDay: null }) },
    expectedRuleId: "dashboard_trajectory.no_test_date",
  },
  {
    label: "Test beyond forecast window",
    condition: "The exact test date lies beyond the reliable forecast horizon.",
    input: { ...BASE_INPUT, state: state("long_range", { testDay: 180 }) },
    expectedRuleId: "dashboard_trajectory.long_range",
  },
  {
    label: "On track",
    condition: "The target is at or below the pessimistic test-day projection.",
    input: { ...BASE_INPUT, state: state("on_track") },
    expectedRuleId: "dashboard_trajectory.on_track",
  },
  {
    label: "On track and improving",
    condition:
      "The target is on track and the estimate improved by at least 20 recent points.",
    input: {
      ...BASE_INPUT,
      state: state("on_track"),
      recentImprovement: 40,
    },
    expectedRuleId: "dashboard_trajectory.on_track_improving",
  },
  {
    label: "Target within reach",
    condition:
      "The target lies inside the plausible test-day projection range.",
    input: { ...BASE_INPUT, state: state("within_reach") },
    expectedRuleId: "dashboard_trajectory.within_reach",
  },
  {
    label: "Within reach and improving",
    condition:
      "The target is within reach and the estimate improved by at least 20 recent points.",
    input: {
      ...BASE_INPUT,
      state: state("within_reach"),
      recentImprovement: 40,
    },
    expectedRuleId: "dashboard_trajectory.within_reach_improving",
  },
  {
    label: "Target very unlikely",
    condition:
      "Even the optimistic test-day projection is at least 150 points below target.",
    input: {
      ...BASE_INPUT,
      state: state("needs_adjustment", {
        targetScore: 2400,
        projectedAtTest: {
          day: 80,
          date: "2026-10-29",
          pessimistic: 2000,
          realistic: 2100,
          optimistic: 2200,
        },
      }),
    },
    expectedRuleId: "dashboard_trajectory.target_very_unlikely",
  },
  {
    label: "Needs adjustment",
    condition:
      "The target is above the optimistic projection, but the gap is below 150 points.",
    input: {
      ...BASE_INPUT,
      state: state("needs_adjustment", {
        targetScore: 2450,
        projectedAtTest: {
          day: 80,
          date: "2026-10-29",
          pessimistic: 2250,
          realistic: 2350,
          optimistic: 2400,
        },
      }),
    },
    expectedRuleId: "dashboard_trajectory.needs_adjustment",
  },
] satisfies Array<
  InsightPreviewCase<
    DashboardTrajectoryInsightInput,
    DashboardTrajectoryInsightRuleId
  >
>;
