import type { InsightPreviewCase } from "@/features/insights/model/insight-preview";
import type {
  SectionScoreInsightRuleId,
  TotalScoreInsightRuleId,
} from "./score-insights";

type TotalScoreInput = {
  currentEstimate: number | null;
  improvement: number | null;
  projectedGain: number | null;
  benchmarkPercentileLabel: string | null;
};

type SectionScoreInput = {
  sectionName: string;
  score: number | null;
  projectedGain: number | null;
  weakestCategory: { name: string; accuracy: number } | null;
  averageExamSpeed: number | null;
};

export const TOTAL_SCORE_INSIGHT_PREVIEW_CASES = [
  {
    label: "Recent improvement",
    condition:
      "The current estimate improved by at least 20 points against recent history.",
    input: {
      currentEstimate: 2100,
      improvement: 30,
      projectedGain: 80,
      benchmarkPercentileLabel: "70th percentile",
    },
    expectedRuleId: "total_score.recent_improvement",
  },
  {
    label: "Projected improvement",
    condition:
      "No 20-point recent improvement exists and the 90-day projected gain is positive.",
    input: {
      currentEstimate: 2050,
      improvement: 10,
      projectedGain: 70,
      benchmarkPercentileLabel: "60th percentile",
    },
    expectedRuleId: "total_score.projected_improvement",
  },
  {
    label: "Building the total baseline",
    condition: "A total score estimate is not yet available.",
    input: {
      currentEstimate: null,
      improvement: null,
      projectedGain: null,
      benchmarkPercentileLabel: null,
    },
    expectedRuleId: "total_score.building_baseline",
  },
  {
    label: "Current estimate",
    condition:
      "An estimate exists without a meaningful recent or projected gain.",
    input: {
      currentEstimate: 2050,
      improvement: 0,
      projectedGain: 0,
      benchmarkPercentileLabel: "60th percentile",
    },
    expectedRuleId: "total_score.current_estimate",
  },
] satisfies Array<InsightPreviewCase<TotalScoreInput, TotalScoreInsightRuleId>>;

const SECTION_BASE = {
  sectionName: "Decision Making",
  score: 620,
  projectedGain: 30,
};

export const SECTION_SCORE_INSIGHT_PREVIEW_CASES = [
  {
    label: "Weakest category without timing",
    condition:
      "An attempted category is weakest and reliable section pace is unavailable.",
    input: {
      ...SECTION_BASE,
      weakestCategory: { name: "Syllogisms", accuracy: 48 },
      averageExamSpeed: null,
    },
    expectedRuleId: "section_score.weakest_category_no_timing",
  },
  {
    label: "Weakest category at fast pace",
    condition:
      "An attempted category is weakest and recent pace is above 1.05×.",
    input: {
      ...SECTION_BASE,
      weakestCategory: { name: "Syllogisms", accuracy: 48 },
      averageExamSpeed: 108,
    },
    expectedRuleId: "section_score.weakest_category_fast",
  },
  {
    label: "Weakest category with workable pace",
    condition:
      "An attempted category is weakest and recent pace is no higher than 1.05×.",
    input: {
      ...SECTION_BASE,
      weakestCategory: { name: "Syllogisms", accuracy: 48 },
      averageExamSpeed: 98,
    },
    expectedRuleId: "section_score.weakest_category_balanced",
  },
  {
    label: "Building a section baseline",
    condition: "No attempted category or section score estimate exists.",
    input: {
      ...SECTION_BASE,
      score: null,
      projectedGain: null,
      weakestCategory: null,
      averageExamSpeed: null,
    },
    expectedRuleId: "section_score.building_baseline",
  },
  {
    label: "Projected section improvement",
    condition:
      "No attempted category is available and the section projection rises.",
    input: {
      ...SECTION_BASE,
      weakestCategory: null,
      averageExamSpeed: 98,
    },
    expectedRuleId: "section_score.projected_improvement",
  },
  {
    label: "Representative section evidence",
    condition:
      "A score exists without a weakest attempted category or projected gain.",
    input: {
      ...SECTION_BASE,
      projectedGain: 0,
      weakestCategory: null,
      averageExamSpeed: 98,
    },
    expectedRuleId: "section_score.representative_evidence",
  },
] satisfies Array<
  InsightPreviewCase<SectionScoreInput, SectionScoreInsightRuleId>
>;
