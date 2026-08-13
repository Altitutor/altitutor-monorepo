import {
  buildSectionScoreInsight,
  buildTotalScoreInsight,
  SECTION_SCORE_INSIGHT_RULE_IDS,
  TOTAL_SCORE_INSIGHT_RULE_IDS,
} from "../score-insights";
import {
  SECTION_SCORE_INSIGHT_PREVIEW_CASES,
  TOTAL_SCORE_INSIGHT_PREVIEW_CASES,
} from "../score-insights.preview";

describe("score insights", () => {
  it("recognises a meaningful total-score improvement", () => {
    expect(
      buildTotalScoreInsight({
        currentEstimate: 2100,
        improvement: 30,
        projectedGain: 80,
        benchmarkPercentileLabel: "70th percentile",
      }),
    ).toMatchObject({
      ruleId: "total_score.recent_improvement",
      title: "Your estimate has improved by 30 points",
    });
  });

  it("prioritises the weakest attempted category in a section", () => {
    expect(
      buildSectionScoreInsight({
        sectionName: "Decision Making",
        score: 620,
        projectedGain: 30,
        weakestCategory: { name: "Syllogisms", accuracy: 48 },
        averageExamSpeed: 108,
      }),
    ).toMatchObject({
      ruleId: "section_score.weakest_category_fast",
      title: "Syllogisms is the clearest opportunity",
    });
  });

  it("has a preview case for every score rule", () => {
    expect(
      new Set(
        TOTAL_SCORE_INSIGHT_PREVIEW_CASES.map(
          ({ input }) => buildTotalScoreInsight(input).ruleId,
        ),
      ),
    ).toEqual(new Set(TOTAL_SCORE_INSIGHT_RULE_IDS));
    expect(
      new Set(
        SECTION_SCORE_INSIGHT_PREVIEW_CASES.map(
          ({ input }) => buildSectionScoreInsight(input).ruleId,
        ),
      ),
    ).toEqual(new Set(SECTION_SCORE_INSIGHT_RULE_IDS));
  });
});
