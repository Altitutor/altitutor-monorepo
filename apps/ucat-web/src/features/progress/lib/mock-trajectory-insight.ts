export const MOCK_TRAJECTORY_INSIGHT_RULE_IDS = [
  "mock_trajectory.no_results",
  "mock_trajectory.improving",
  "mock_trajectory.declining",
  "mock_trajectory.stable",
] as const;

export type MockTrajectoryInsightRuleId =
  (typeof MOCK_TRAJECTORY_INSIGHT_RULE_IDS)[number];

export type MockTrajectoryInsight = {
  ruleId: MockTrajectoryInsightRuleId;
  title: "Mock insight";
  body: string;
};

export function buildMockTrajectoryInsight({
  trend,
}: {
  trend: number | null;
}): MockTrajectoryInsight {
  if (trend == null) {
    return {
      ruleId: "mock_trajectory.no_results",
      title: "Mock insight",
      body: "Complete your first mock to see your progress.",
    };
  }
  if (trend > 0) {
    return {
      ruleId: "mock_trajectory.improving",
      title: "Mock insight",
      body: `Your recent mock scores are up ${trend} points across the selected period. Check the section breakdown to see whether that improvement is balanced.`,
    };
  }
  if (trend < 0) {
    return {
      ruleId: "mock_trajectory.declining",
      title: "Mock insight",
      body: `Your recent mock scores are down ${Math.abs(trend)} points. Review timing and section-level misses before the next mock.`,
    };
  }
  return {
    ruleId: "mock_trajectory.stable",
    title: "Mock insight",
    body: "Your mock scores are stable. Section-level review is the best way to find the next gain.",
  };
}
