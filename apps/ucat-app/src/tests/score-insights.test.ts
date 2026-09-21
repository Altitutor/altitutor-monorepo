import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSectionScoreInsight,
  buildTotalScoreInsight,
} from "../features/progress/score-insights";

test("insights distinguish a missing baseline from a measured improvement", () => {
  assert.equal(
    buildTotalScoreInsight({
      currentEstimate: null,
      improvement: null,
      projectedGain: null,
      benchmarkPercentileLabel: null,
    }).ruleId,
    "total_score.building_baseline",
  );
  assert.equal(
    buildTotalScoreInsight({
      currentEstimate: 2100,
      improvement: 30,
      projectedGain: 80,
      benchmarkPercentileLabel: null,
    }).ruleId,
    "total_score.recent_improvement",
  );
});
test("section advice prioritises attempted weaknesses and uses real timing evidence", () => {
  const input = {
    sectionName: "Decision Making",
    score: 620,
    projectedGain: 30,
    weakestCategory: { name: "Syllogisms", accuracy: 48 },
  };
  assert.equal(
    buildSectionScoreInsight({ ...input, averageExamSpeed: null }).ruleId,
    "section_score.weakest_category_no_timing",
  );
  const fast = buildSectionScoreInsight({ ...input, averageExamSpeed: 108 });
  assert.equal(fast.ruleId, "section_score.weakest_category_fast");
  assert.match(fast.body, /1\.08x/);
  assert.equal(
    buildSectionScoreInsight({ ...input, averageExamSpeed: 100 }).ruleId,
    "section_score.weakest_category_balanced",
  );
});
