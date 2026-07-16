import {
  calculateMidrankPercentile,
  calculatePercentileFromBins,
  resolveCohortPercentile,
} from "../cohort";

describe("cohort percentiles", () => {
  it("uses a midrank percentile so tied students share the same result", () => {
    expect(
      calculateMidrankPercentile({
        cohortSize: 20,
        scoresBelow: 9,
        scoresEqual: 2,
      }),
    ).toBe(50);
  });

  it("does not publish a percentile before the cohort reaches the threshold", () => {
    expect(
      resolveCohortPercentile({
        targetScore: 600,
        cohortSize: 19,
        scoresBelow: 10,
        scoresEqual: 1,
        bins: [{ score: 600, count: 1 }],
      }),
    ).toMatchObject({ status: "insufficient_data", cohortSize: 19 });
  });

  it("calculates hover percentiles from anonymous score bins", () => {
    expect(
      calculatePercentileFromBins(600, [
        { score: 500, count: 4 },
        { score: 600, count: 2 },
        { score: 700, count: 4 },
      ]),
    ).toBe(50);
  });
});
