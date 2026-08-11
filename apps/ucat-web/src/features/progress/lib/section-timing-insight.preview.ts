import type { InsightPreviewCase } from "@/features/insights/model/insight-preview";
import type { SectionTimingInsightRuleId } from "./section-timing-insight";

type TimingInput = { pace: number | null; accuracy: number | null };

export const SECTION_TIMING_INSIGHT_PREVIEW_CASES = [
  {
    label: "No timed practice",
    condition: "Recent pace is unavailable.",
    input: { pace: null, accuracy: null },
    expectedRuleId: "section_timing.no_pace",
  },
  {
    label: "Fast and inaccurate",
    condition: "Recent pace is above 1.10× and accuracy is below 70%.",
    input: { pace: 118, accuracy: 64 },
    expectedRuleId: "section_timing.fast_low_accuracy",
  },
  {
    label: "Fast with protected accuracy",
    condition: "Recent pace is above 1.10× and accuracy is at least 70%.",
    input: { pace: 118, accuracy: 78 },
    expectedRuleId: "section_timing.fast_protect_accuracy",
  },
  {
    label: "Below the pace guide",
    condition: "Recent pace is below 0.90×.",
    input: { pace: 82, accuracy: 76 },
    expectedRuleId: "section_timing.slow_pace",
  },
  {
    label: "Balanced pace, low accuracy",
    condition: "Recent pace is within 0.90×–1.10× and accuracy is below 70%.",
    input: { pace: 100, accuracy: 62 },
    expectedRuleId: "section_timing.balanced_pace_low_accuracy",
  },
  {
    label: "Balanced pace and accuracy",
    condition:
      "Recent pace is within 0.90×–1.10× and accuracy is at least 70% or unavailable.",
    input: { pace: 100, accuracy: 76 },
    expectedRuleId: "section_timing.balanced",
  },
] satisfies Array<InsightPreviewCase<TimingInput, SectionTimingInsightRuleId>>;
