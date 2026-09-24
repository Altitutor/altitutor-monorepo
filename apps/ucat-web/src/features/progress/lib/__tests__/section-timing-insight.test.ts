import {
  buildSectionTimingInsight,
  SECTION_TIMING_INSIGHT_RULE_IDS,
} from "../section-timing-insight";
import { SECTION_TIMING_INSIGHT_PREVIEW_CASES } from "../section-timing-insight.preview";

describe("buildSectionTimingInsight", () => {
  it("prioritises accuracy when recent work is both fast and inaccurate", () => {
    expect(
      buildSectionTimingInsight({ pace: 118, accuracy: 64 }),
    ).toMatchObject({
      ruleId: "section_timing.fast_low_accuracy",
      title: "You may be moving faster than your accuracy can support",
    });
  });

  it("has a preview case for every timing rule", () => {
    const reachedRules = SECTION_TIMING_INSIGHT_PREVIEW_CASES.map(
      ({ input }) => buildSectionTimingInsight(input).ruleId,
    );

    expect(new Set(reachedRules)).toEqual(
      new Set(SECTION_TIMING_INSIGHT_RULE_IDS),
    );
  });
});
