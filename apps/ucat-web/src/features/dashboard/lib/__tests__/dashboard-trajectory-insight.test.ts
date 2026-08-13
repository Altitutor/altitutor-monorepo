import {
  buildDashboardTrajectoryInsight,
  DASHBOARD_TRAJECTORY_INSIGHT_RULE_IDS,
} from "../dashboard-trajectory-insight";
import { DASHBOARD_TRAJECTORY_INSIGHT_PREVIEW_CASES } from "../dashboard-trajectory-insight.preview";
import type { DashboardTrajectoryState } from "../dashboard-trajectory";

function state(
  overrides: Partial<DashboardTrajectoryState>,
): DashboardTrajectoryState {
  return {
    stage: "needs_adjustment",
    currentEstimate: 1900,
    confidence: "high",
    targetScore: 2400,
    testDay: 80,
    forecastHorizonDays: 120,
    forecastPoint: null,
    projectedAtTest: {
      day: 80,
      date: "2026-10-29",
      pessimistic: 2000,
      realistic: 2100,
      optimistic: 2200,
    },
    readySectionCount: 3,
    missingSectionNames: [],
    ...overrides,
  };
}

describe("buildDashboardTrajectoryInsight", () => {
  it("does not render an empty section list while building a baseline", () => {
    const insight = buildDashboardTrajectoryInsight({
      state: state({
        stage: "building_baseline",
        currentEstimate: null,
        confidence: null,
        readySectionCount: 0,
        missingSectionNames: [],
      }),
      weakestSection: null,
      recentImprovement: null,
      studyPlanEnabled: true,
    });

    expect(insight.body).toBe(
      "Complete more timed practice across the cognitive sections to build a reliable estimate.",
    );
  });

  it("identifies a target outside even the optimistic range", () => {
    expect(
      buildDashboardTrajectoryInsight({
        state: state({}),
        weakestSection: { name: "Verbal Reasoning", gap: 90 },
        recentImprovement: null,
        studyPlanEnabled: true,
      }),
    ).toMatchObject({
      ruleId: "dashboard_trajectory.target_very_unlikely",
      actionHref: "/settings/study-plan",
    });
  });

  it("keeps the long-range coaching title separate from the countdown", () => {
    expect(
      buildDashboardTrajectoryInsight({
        state: state({ stage: "long_range", testDay: 180 }),
        weakestSection: null,
        recentImprovement: null,
        studyPlanEnabled: true,
      }),
    ).toMatchObject({
      ruleId: "dashboard_trajectory.long_range",
      title: "Your test is beyond the reliable forecast window",
    });
  });

  it("has a preview case for every dashboard trajectory rule", () => {
    expect(
      new Set(
        DASHBOARD_TRAJECTORY_INSIGHT_PREVIEW_CASES.map(
          ({ input }) => buildDashboardTrajectoryInsight(input).ruleId,
        ),
      ),
    ).toEqual(new Set(DASHBOARD_TRAJECTORY_INSIGHT_RULE_IDS));
  });
});
