import { formatSpeedPercentAsMultiplier } from "./format-speed-multiplier";

export const SECTION_TIMING_INSIGHT_RULE_IDS = [
  "section_timing.no_pace",
  "section_timing.fast_low_accuracy",
  "section_timing.fast_protect_accuracy",
  "section_timing.slow_pace",
  "section_timing.balanced_pace_low_accuracy",
  "section_timing.balanced",
] as const;

export type SectionTimingInsightRuleId =
  (typeof SECTION_TIMING_INSIGHT_RULE_IDS)[number];

export type SectionTimingInsight = {
  ruleId: SectionTimingInsightRuleId;
  title: string;
  body: string;
};

export function buildSectionTimingInsight({
  pace,
  accuracy,
}: {
  pace: number | null;
  accuracy: number | null;
}): SectionTimingInsight {
  if (pace == null) {
    return {
      ruleId: "section_timing.no_pace",
      title: "Practice a clean timing routine first",
      body: "Choose a short timed set. Make a deliberate solve, flag, or skip decision whenever you get stuck, then review whether each miss came from the method or from rushing.",
    };
  }
  if (pace > 110 && (accuracy == null || accuracy < 70)) {
    return {
      ruleId: "section_timing.fast_low_accuracy",
      title: "You may be moving faster than your accuracy can support",
      body: `Your recent pace is ${formatSpeedPercentAsMultiplier(pace)}${accuracy == null ? "" : ` with ${Math.round(accuracy)}% accuracy`}. Points in the top-left of this chart (fast + inaccurate) usually mean slowing down on questions you can still get right will help more than saving time.`,
    };
  }
  if (pace > 110) {
    return {
      ruleId: "section_timing.fast_protect_accuracy",
      title: "Your pace is fast—protect the accuracy behind it",
      body: `You’re working at ${formatSpeedPercentAsMultiplier(pace)} exam speed. That is useful only while your accuracy holds up, so use the category breakdown to check where speed is creating avoidable misses.`,
    };
  }
  if (pace < 90) {
    return {
      ruleId: "section_timing.slow_pace",
      title: "Timing pressure is the main thing holding you back",
      body: `You’re working at ${formatSpeedPercentAsMultiplier(pace)} exam speed. Practice making an earlier decision on difficult questions so you preserve enough time for the questions you are more likely to answer correctly.`,
    };
  }
  if (accuracy != null && accuracy < 70) {
    return {
      ruleId: "section_timing.balanced_pace_low_accuracy",
      title: "Your pace is balanced; accuracy is the best next focus",
      body: `Your recent pace is ${formatSpeedPercentAsMultiplier(pace)}, around exam pace, while accuracy is ${Math.round(accuracy)}%. Keep the pace steady and focus review on the reasoning patterns behind your misses.`,
    };
  }
  return {
    ruleId: "section_timing.balanced",
    title: "Your pace and accuracy are working together",
    body: `Your recent pace is ${formatSpeedPercentAsMultiplier(pace)}${accuracy == null ? "" : ` with ${Math.round(accuracy)}% accuracy`}. Keep testing this balance in realistic timed sets rather than chasing speed by itself.`,
  };
}
