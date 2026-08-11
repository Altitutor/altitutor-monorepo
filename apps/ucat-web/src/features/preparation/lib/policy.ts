import type {
  PreparationTimingProfile,
  PreparationVersions,
} from "@/features/preparation/model/types";

export const CURRENT_PREPARATION_VERSIONS: PreparationVersions = Object.freeze({
  engine: "preparation-engine-v1",
  policy: "evidence-driven-preparation-policy-v2",
  scoreModel: "representative-evidence-score-v1",
});

export const STANDARD_PREPARATION_TIMING_PROFILE: PreparationTimingProfile = {
  id: "standard",
  version: "standard-timing-v1",
  defaultTimeMultiplier: 1,
  sectionTimeMultipliers: {},
  restBreaks: [],
};
