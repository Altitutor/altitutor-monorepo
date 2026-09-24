import { lookupUcatAnzTotalPercentile } from "../ucat-anz";

describe("UCAT ANZ total score benchmark", () => {
  it("matches published 2025 decile anchors", () => {
    expect(lookupUcatAnzTotalPercentile(1930)).toMatchObject({
      status: "available",
      percentile: 50,
      percentileLabel: "50th percentile",
    });
  });

  it("interpolates between published deciles and labels the result as estimated in the UI", () => {
    expect(lookupUcatAnzTotalPercentile(2140)).toMatchObject({
      status: "available",
      percentile: 75,
    });
  });

  it("does not invent precision outside the published decile range", () => {
    expect(lookupUcatAnzTotalPercentile(1500).percentileLabel).toBe(
      "Below 10th percentile",
    );
    expect(lookupUcatAnzTotalPercentile(2400).percentileLabel).toBe(
      "Above 90th percentile",
    );
  });
});
