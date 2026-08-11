export const UCAT_MOCK_CADENCE_POLICY = Object.freeze({
  version: "ucat-mock-cadence-v1",
  farTimingIntervalDays: 28,
  midTimingIntervalDays: 14,
  earlyExamIntervalDays: 7,
  finalMonthMocksPerWeek: 3,
  finalRecoveryDays: 2,
  mockRecoveryDays: 2,
});

type MockCadence = {
  intervalDays: number;
  mocksPerWeek: number | null;
};

function mockCadence(daysUntilExam: number): MockCadence {
  if (daysUntilExam <= 28) {
    return {
      intervalDays: UCAT_MOCK_CADENCE_POLICY.mockRecoveryDays,
      mocksPerWeek: UCAT_MOCK_CADENCE_POLICY.finalMonthMocksPerWeek,
    };
  }
  return {
    intervalDays:
      daysUntilExam <= 60
        ? UCAT_MOCK_CADENCE_POLICY.earlyExamIntervalDays
        : daysUntilExam <= 120
          ? UCAT_MOCK_CADENCE_POLICY.midTimingIntervalDays
          : UCAT_MOCK_CADENCE_POLICY.farTimingIntervalDays,
    mocksPerWeek: null,
  };
}

export function targetMocksInHorizon(input: {
  daysUntilExam: number;
  horizonDays: number;
}): number {
  const cadence = mockCadence(input.daysUntilExam);
  if (cadence.mocksPerWeek != null) {
    return Math.max(
      1,
      Math.ceil((input.horizonDays / 7) * cadence.mocksPerWeek),
    );
  }
  return Math.max(1, Math.ceil(input.horizonDays / cadence.intervalDays));
}

export function mockIntervalDays(daysUntilExam: number): number {
  return mockCadence(daysUntilExam).intervalDays;
}
