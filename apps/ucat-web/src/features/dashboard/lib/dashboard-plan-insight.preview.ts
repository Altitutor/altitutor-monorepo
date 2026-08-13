import type { InsightPreviewCase } from "@/features/insights/model/insight-preview";
import type {
  DashboardPlanInsightInput,
  DashboardPlanInsightRuleId,
} from "./dashboard-plan-insight";

export const DASHBOARD_PLAN_INSIGHT_PREVIEW_CASES = [
  {
    label: "Study plan unavailable",
    condition: "The dashboard Study plan request failed.",
    input: { planUnavailable: true },
    expectedRuleId: "dashboard_plan.unavailable",
  },
  {
    label: "No Study plan",
    condition: "No personal Study plan exists for the student.",
    input: { planUnavailable: false },
    expectedRuleId: "dashboard_plan.required",
  },
] satisfies Array<
  InsightPreviewCase<DashboardPlanInsightInput, DashboardPlanInsightRuleId>
>;
