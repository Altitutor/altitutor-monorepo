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

  it("explains the 120-day bound when year-only timing has no improvement or section gap", () => {
    expect(
      buildDashboardTrajectoryInsight({
        state: state({
          stage: "no_test_date",
          testDay: null,
          forecastHorizonDays: 120,
        }),
        weakestSection: null,
        recentImprovement: null,
        studyPlanEnabled: true,
      }),
    ).toEqual({
      ruleId: "dashboard_trajectory.no_test_date",
      title: "This is a 120-day outlook",
      body: "An exact test date isn't booked yet, so this chart shows the next 120 days rather than exam day. Keep following today's work.",
    });
  });

  it("reports stored improvement for a bounded outlook without judging exam day", () => {
    expect(
      buildDashboardTrajectoryInsight({
        state: state({
          stage: "no_test_date",
          testDay: null,
        }),
        weakestSection: null,
        recentImprovement: 40,
        studyPlanEnabled: true,
      }),
    ).toEqual({
      ruleId: "dashboard_trajectory.bounded_outlook_improving",
      title: "Your estimate is up 40 points",
      body: "Keep following today's Study plan. More timed practice will keep this estimate moving.",
    });
  });

  it("names the largest Study plan section gap under a bounded-outlook improvement", () => {
    expect(
      buildDashboardTrajectoryInsight({
        state: state({
          stage: "no_test_date",
          testDay: null,
        }),
        weakestSection: { name: "Verbal Reasoning", gap: 80 },
        recentImprovement: 40,
        studyPlanEnabled: true,
      }),
    ).toEqual({
      ruleId: "dashboard_trajectory.bounded_outlook_improving",
      title: "Your estimate is up 40 points",
      body: "Verbal Reasoning still has the largest section gap at 80 points below its Study plan target, so today’s work keeps focus there.",
    });
  });

  it("names the largest Study plan section gap when a bounded outlook has no recent improvement", () => {
    expect(
      buildDashboardTrajectoryInsight({
        state: state({
          stage: "no_test_date",
          testDay: null,
        }),
        weakestSection: { name: "Verbal Reasoning", gap: 80 },
        recentImprovement: null,
        studyPlanEnabled: true,
      }),
    ).toEqual({
      ruleId: "dashboard_trajectory.bounded_outlook_section_gap",
      title: "Verbal Reasoning still has the largest section gap",
      body: "It's 80 points below its Study plan target. Start with today's next step and keep practising.",
    });
  });

  it("uses the same bounded-outlook improvement rule when the booked date is beyond the window", () => {
    expect(
      buildDashboardTrajectoryInsight({
        state: state({ stage: "long_range", testDay: 180 }),
        weakestSection: null,
        recentImprovement: 40,
        studyPlanEnabled: true,
      }).ruleId,
    ).toBe("dashboard_trajectory.bounded_outlook_improving");
  });

  it("uses the same section-gap rule when the booked date is beyond the window", () => {
    expect(
      buildDashboardTrajectoryInsight({
        state: state({ stage: "long_range", testDay: 180 }),
        weakestSection: { name: "Decision Making", gap: 50 },
        recentImprovement: null,
        studyPlanEnabled: true,
      }).ruleId,
    ).toBe("dashboard_trajectory.bounded_outlook_section_gap");
  });

  it("ignores a zero section gap when explaining a bounded outlook", () => {
    expect(
      buildDashboardTrajectoryInsight({
        state: state({
          stage: "no_test_date",
          testDay: null,
        }),
        weakestSection: { name: "Verbal Reasoning", gap: 0 },
        recentImprovement: null,
        studyPlanEnabled: true,
      }).ruleId,
    ).toBe("dashboard_trajectory.no_test_date");
  });

  it("points next-step students at practice when a bounded outlook improves", () => {
    expect(
      buildDashboardTrajectoryInsight({
        state: state({
          stage: "no_test_date",
          testDay: null,
        }),
        weakestSection: null,
        recentImprovement: 40,
        studyPlanEnabled: false,
      }).body,
    ).toBe(
      "Keep using your next steps. More timed practice will keep this estimate moving.",
    );
  });

  it("explains the forecast bound when the booked date is beyond the window", () => {
    expect(
      buildDashboardTrajectoryInsight({
        state: state({ stage: "long_range", testDay: 180 }),
        weakestSection: null,
        recentImprovement: null,
        studyPlanEnabled: true,
      }),
    ).toEqual({
      ruleId: "dashboard_trajectory.long_range",
      title: "Your test is beyond the reliable forecast window",
      body: "Your score projection shows the next 120 days. We'll judge exam-day progress once your test is inside that window. Keep following today's work.",
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
