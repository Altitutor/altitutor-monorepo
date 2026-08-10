export const DASHBOARD_PLAN_INSIGHT_RULE_IDS = [
  "dashboard_plan.unavailable",
  "dashboard_plan.required",
] as const;

export type DashboardPlanInsightRuleId =
  (typeof DASHBOARD_PLAN_INSIGHT_RULE_IDS)[number];

export type DashboardPlanInsightInput = { planUnavailable: boolean };

export function buildDashboardPlanInsight({
  planUnavailable,
}: DashboardPlanInsightInput): {
  ruleId: DashboardPlanInsightRuleId;
  title: string;
  body: string;
  compactBody: string;
} {
  return planUnavailable
    ? {
        ruleId: "dashboard_plan.unavailable",
        title: "We couldn’t load your Study plan",
        body: "Your existing plan has not been changed. Reload it before starting unrelated work.",
        compactBody:
          "Your existing plan has not been changed. Reload it before starting unrelated work.",
      }
    : {
        ruleId: "dashboard_plan.required",
        title: "A goal needs a path",
        body: "Add your target score and test date so Altitutor UCAT can estimate where you stand and show how your trajectory changes.",
        compactBody:
          "Build a Study plan to replace this preview with your target and real evidence.",
      };
}
