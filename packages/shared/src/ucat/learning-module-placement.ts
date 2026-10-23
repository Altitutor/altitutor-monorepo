export const LEARNING_MODULE_JOURNEY_PLACEMENTS = {
  section_learning: "Section learning",
  orientation: "Orientation",
  later_learning: "Later Learning",
  pre_exam: "Pre-Exam",
} as const;

export type LearningModuleJourneyPlacement = keyof typeof LEARNING_MODULE_JOURNEY_PLACEMENTS;

export function isLearningModuleJourneyPlacement(value: unknown): value is LearningModuleJourneyPlacement {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LEARNING_MODULE_JOURNEY_PLACEMENTS, value);
}
