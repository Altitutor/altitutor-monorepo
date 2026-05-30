import { computeRNeeded, getTrajectoryStatus } from "../study-plan-generator";

describe("study-plan-generator", () => {
  it("flags ceiling warning when target exceeds predicted ceiling", () => {
    const result = computeRNeeded({
      targetScore: 780,
      sHat: 640,
      sInf: 740,
      k: 0.00014,
      qCumulative: 300,
      daysRemaining: 30,
    });

    expect(result.ceilingWarning).toBe(true);
    expect(result.paceWarning).toBe(true);
  });

  it("returns pace warning for unsustainable question load", () => {
    const result = computeRNeeded({
      targetScore: 730,
      sHat: 620,
      sInf: 760,
      k: 0.00001,
      qCumulative: 150,
      daysRemaining: 10,
      maxDailyQuestions: 120,
    });

    expect(result.ceilingWarning).toBe(false);
    expect(result.paceWarning).toBe(true);
  });

  it("computes trajectory status buckets", () => {
    expect(getTrajectoryStatus(770, 740)).toBe("ahead");
    expect(getTrajectoryStatus(735, 740)).toBe("on_track");
    expect(getTrajectoryStatus(715, 740)).toBe("behind");
    expect(getTrajectoryStatus(670, 740)).toBe("at_risk");
  });
});
