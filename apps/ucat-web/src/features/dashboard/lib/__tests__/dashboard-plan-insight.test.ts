import {
  buildDashboardPlanInsight,
  DASHBOARD_PLAN_INSIGHT_RULE_IDS,
} from "../dashboard-plan-insight";
import { DASHBOARD_PLAN_INSIGHT_PREVIEW_CASES } from "../dashboard-plan-insight.preview";

describe("buildDashboardPlanInsight", () => {
  it("distinguishes an unavailable Study plan from a missing one", () => {
    expect(buildDashboardPlanInsight({ planUnavailable: true }).ruleId).toBe(
      "dashboard_plan.unavailable",
    );
    expect(buildDashboardPlanInsight({ planUnavailable: false }).ruleId).toBe(
      "dashboard_plan.required",
    );
  });

  it("has a preview case for every dashboard plan rule", () => {
    expect(
      new Set(
        DASHBOARD_PLAN_INSIGHT_PREVIEW_CASES.map(
          ({ input }) => buildDashboardPlanInsight(input).ruleId,
        ),
      ),
    ).toEqual(new Set(DASHBOARD_PLAN_INSIGHT_RULE_IDS));
  });
});
