export const UCAT_QUESTION_TIME_BURDEN_DEFINITION =
  "Expected active working time, in whole seconds, for a candidate from the target UCAT cohort to submit a fully correct answer on first exposure, under realistic section timing and without assistance. The question is encountered in its authored position within the stem.";

export function isValidUcatQuestionTimeBurden(
  seconds: number | null | undefined,
): boolean {
  return seconds == null || (Number.isInteger(seconds) && seconds > 0);
}
