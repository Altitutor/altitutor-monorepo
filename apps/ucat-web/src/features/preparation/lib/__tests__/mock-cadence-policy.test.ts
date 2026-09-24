import {
  mockTargetDaysBeforeExam,
  UCAT_MOCK_CADENCE_POLICY,
} from "@/features/preparation/lib/mock-cadence-policy";

describe("UCAT mock cadence policy", () => {
  it("caps a complete preparation cycle at 20 mock targets inside 120 days", () => {
    const targets = mockTargetDaysBeforeExam();

    expect(targets).toHaveLength(20);
    expect(targets.every((days) => days <= 120 && days > 2)).toBe(true);
    expect(targets.filter((days) => days >= 61)).toHaveLength(4);
    expect(targets.filter((days) => days >= 29 && days <= 60)).toHaveLength(4);
    expect(targets.filter((days) => days <= 28)).toHaveLength(12);
    expect(UCAT_MOCK_CADENCE_POLICY.maximumMocksPerCycle).toBe(20);
  });

  it("keeps every target at least two days from the next one and the exam", () => {
    const targets = mockTargetDaysBeforeExam();

    expect(Math.min(...targets)).toBeGreaterThanOrEqual(3);
    for (const [index, target] of targets.entries()) {
      const next = targets[index + 1];
      if (next != null) expect(target - next).toBeGreaterThanOrEqual(2);
    }
  });
});
