import { runKalmanFilter } from "../kalman-filter";

describe("runKalmanFilter", () => {
  it("moves sHat toward observations and reduces uncertainty", () => {
    const result = runKalmanFilter(
      [{ score: 520 }, { score: 560 }, { score: 590 }],
      2500,
      1600,
      500,
    );

    expect(result.sHat).toBeGreaterThan(500);
    expect(result.sHat).toBeLessThan(590);
    expect(result.p).toBeLessThan(2500);
  });

  it("rejects invalid parameters", () => {
    expect(() => runKalmanFilter([], 0, 100, 500)).toThrow("p0 must be > 0");
    expect(() => runKalmanFilter([], 10, 0, 500)).toThrow("r must be > 0");
  });
});
