import { formatSpeedPercentAsMultiplier } from "./format-speed-multiplier";

export const TOTAL_SCORE_INSIGHT_RULE_IDS = [
  "total_score.recent_improvement",
  "total_score.projected_improvement",
  "total_score.building_baseline",
  "total_score.current_estimate",
] as const;

export const SECTION_SCORE_INSIGHT_RULE_IDS = [
  "section_score.weakest_category_no_timing",
  "section_score.weakest_category_fast",
  "section_score.weakest_category_balanced",
  "section_score.building_baseline",
  "section_score.projected_improvement",
  "section_score.representative_evidence",
] as const;

export type TotalScoreInsightRuleId =
  (typeof TOTAL_SCORE_INSIGHT_RULE_IDS)[number];
export type SectionScoreInsightRuleId =
  (typeof SECTION_SCORE_INSIGHT_RULE_IDS)[number];

export type ScoreInsight = {
  ruleId: TotalScoreInsightRuleId | SectionScoreInsightRuleId;
  title: string;
  body: string;
};

export function buildTotalScoreInsight({
  currentEstimate,
  improvement,
  projectedGain,
  benchmarkPercentileLabel,
}: {
  currentEstimate: number | null;
  improvement: number | null;
  projectedGain: number | null;
  benchmarkPercentileLabel: string | null;
}): ScoreInsight & { ruleId: TotalScoreInsightRuleId } {
  const body =
    currentEstimate == null
      ? "Complete one timed set in each of Sections 1–3 to build a score estimate."
      : benchmarkPercentileLabel
        ? `Your ${currentEstimate} estimate is around the ${benchmarkPercentileLabel.toLowerCase()} against the published UCAT ANZ benchmark.`
        : "Keep completing timed practice. The shaded range will narrow as you complete more realistic timed work across Sections 1–3.";

  if (improvement != null && improvement >= 20) {
    return {
      ruleId: "total_score.recent_improvement",
      title: `Your estimate has improved by ${improvement} points`,
      body,
    };
  }
  if (projectedGain != null && projectedGain > 0) {
    return {
      ruleId: "total_score.projected_improvement",
      title: `Your score is predicted to improve by about ${projectedGain} points over the next 90 days`,
      body,
    };
  }
  if (currentEstimate == null) {
    return {
      ruleId: "total_score.building_baseline",
      title: "Build your score estimate one section at a time",
      body,
    };
  }
  return {
    ruleId: "total_score.current_estimate",
    title: "Your estimate is a starting point—not a final score",
    body,
  };
}

export function buildSectionScoreInsight({
  sectionName,
  score,
  projectedGain,
  weakestCategory,
  averageExamSpeed,
}: {
  sectionName: string;
  score: number | null;
  projectedGain: number | null;
  weakestCategory: { name: string; accuracy: number } | null;
  averageExamSpeed: number | null;
}): ScoreInsight & { ruleId: SectionScoreInsightRuleId } {
  if (weakestCategory) {
    const timing: { ruleId: SectionScoreInsightRuleId; sentence: string } =
      averageExamSpeed == null
        ? {
            ruleId: "section_score.weakest_category_no_timing",
            sentence:
              " Complete more timed sets to add a reliable timing insight.",
          }
        : averageExamSpeed > 105
          ? {
              ruleId: "section_score.weakest_category_fast",
              sentence: ` Your recent exam speed is ${formatSpeedPercentAsMultiplier(averageExamSpeed)}, so accuracy is the main thing holding you back.`,
            }
          : {
              ruleId: "section_score.weakest_category_balanced",
              sentence: ` Your recent exam speed is ${formatSpeedPercentAsMultiplier(averageExamSpeed)}, so timing and accuracy should improve together.`,
            };
    return {
      ruleId: timing.ruleId,
      title: `${weakestCategory.name} is the clearest opportunity`,
      body: `${Math.round(weakestCategory.accuracy)}% accuracy makes this your weakest attempted category.${timing.sentence}`,
    };
  }

  const body =
    "Choose a short timed set and work at your normal pace. Afterwards, review the first missed reasoning step before trying to get faster.";
  if (score == null) {
    return {
      ruleId: "section_score.building_baseline",
      title: `Start ${sectionName} with a realistic timed set`,
      body,
    };
  }
  if (projectedGain != null && projectedGain > 0) {
    return {
      ruleId: "section_score.projected_improvement",
      title: `Your score is predicted to improve by about ${projectedGain} points`,
      body,
    };
  }
  return {
    ruleId: "section_score.representative_evidence",
    title: "Keep practising with realistic timed sets",
    body,
  };
}
