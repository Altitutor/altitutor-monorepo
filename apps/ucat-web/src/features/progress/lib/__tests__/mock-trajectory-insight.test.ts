import {
  buildMockTrajectoryInsight,
  MOCK_TRAJECTORY_INSIGHT_RULE_IDS,
} from "../mock-trajectory-insight";
import { MOCK_TRAJECTORY_INSIGHT_PREVIEW_CASES } from "../mock-trajectory-insight.preview";

describe("buildMockTrajectoryInsight", () => {
  it("distinguishes a declining mock trajectory", () => {
    expect(buildMockTrajectoryInsight({ trend: -90 })).toEqual({
      ruleId: "mock_trajectory.declining",
      title: "Mock insight",
      body: "Your recent mock trajectory is down 90 points. Review timing and section-level misses before the next mock.",
    });
  });

  it("has a preview case for every mock trajectory rule", () => {
    expect(
      new Set(
        MOCK_TRAJECTORY_INSIGHT_PREVIEW_CASES.map(
          ({ input }) => buildMockTrajectoryInsight(input).ruleId,
        ),
      ),
    ).toEqual(new Set(MOCK_TRAJECTORY_INSIGHT_RULE_IDS));
  });
});
