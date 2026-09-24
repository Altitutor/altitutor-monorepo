import type {
  PreparationTimingProfile,
  PreparationVersions,
} from "@/features/preparation/model/types";

export const CURRENT_PREPARATION_VERSIONS: PreparationVersions = Object.freeze({
  engine: "preparation-engine-v1",
  policy: "evidence-driven-preparation-policy-v7",
  scoreModel: "pooled-representative-evidence-score-v2",
  trajectoryModel: "observed-behavior-trajectory-v2",
});

/**
 * The buffer above half a section absorbs whole-stem rounding while keeping
 * the 1.5-equivalent calibration threshold reachable in three Learning loops.
 */
export const LEARNING_LOOP_TARGET_SECTION_EQUIVALENTS = 0.6;

export function learningLoopTargetQuestionCount(
  sectionQuestionCount: number,
): number {
  return Math.max(
    1,
    Math.ceil(sectionQuestionCount * LEARNING_LOOP_TARGET_SECTION_EQUIVALENTS),
  );
}

export const STANDARD_PREPARATION_TIMING_PROFILE: PreparationTimingProfile = {
  id: "standard",
  version: "standard-timing-v1",
  defaultTimeMultiplier: 1,
  sectionTimeMultipliers: {},
  restBreaks: [],
};
