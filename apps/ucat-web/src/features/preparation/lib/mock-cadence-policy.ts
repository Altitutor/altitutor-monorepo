const MOCK_TARGET_DAYS_BEFORE_EXAM = Object.freeze([
  120,
  105,
  90,
  75,
  60,
  52,
  44,
  36,
  28,
  26,
  24,
  21,
  19,
  17,
  14,
  12,
  10,
  7,
  5,
  3,
]);

export const UCAT_MOCK_CADENCE_POLICY = Object.freeze({
  version: "ucat-mock-cadence-v2",
  beginsDaysBeforeExam: 120,
  finalRecoveryDays: 2,
  mockRecoveryDays: 2,
  maximumMocksPerCycle: MOCK_TARGET_DAYS_BEFORE_EXAM.length,
});

/**
 * Fixed mock targets keep the complete preparation cycle bounded at 20 while
 * still allowing availability and readiness to reduce an individual plan.
 */
export function mockTargetDaysBeforeExam(): readonly number[] {
  return MOCK_TARGET_DAYS_BEFORE_EXAM;
}
