import type { InsightPreviewCase } from "@/features/insights/model/insight-preview";
import type { MockTrajectoryInsightRuleId } from "./mock-trajectory-insight";

type MockTrajectoryInput = { trend: number | null };

export const MOCK_TRAJECTORY_INSIGHT_PREVIEW_CASES = [
  {
    label: "No completed mocks",
    condition:
      "Fewer than two scored mock points exist in the selected period.",
    input: { trend: null },
    expectedRuleId: "mock_trajectory.no_results",
  },
  {
    label: "Improving mock trajectory",
    condition: "The selected-period mock score trend is positive.",
    input: { trend: 90 },
    expectedRuleId: "mock_trajectory.improving",
  },
  {
    label: "Declining mock trajectory",
    condition: "The selected-period mock score trend is negative.",
    input: { trend: -90 },
    expectedRuleId: "mock_trajectory.declining",
  },
  {
    label: "Stable mock trajectory",
    condition: "The selected-period mock score trend is zero.",
    input: { trend: 0 },
    expectedRuleId: "mock_trajectory.stable",
  },
] satisfies Array<
  InsightPreviewCase<MockTrajectoryInput, MockTrajectoryInsightRuleId>
>;
