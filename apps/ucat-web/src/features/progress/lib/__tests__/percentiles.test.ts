import {
  formatUcatPercentile,
  getUcatPercentile,
  getUcatScoreRange,
} from "../percentiles";

describe("UCAT percentiles", () => {
  it("maps section anchor scores to their percentile", () => {
    expect(getUcatPercentile(600, "section")).toBe(50);
    expect(getUcatPercentile(700, "section")).toBe(80);
  });

  it("uses the summed three-section range for mocks", () => {
    expect(getUcatPercentile(1800, "mock")).toBe(50);
    expect(getUcatScoreRange("mock")).toEqual({ min: 900, max: 2700 });
  });

  it("keeps low percentiles intentionally broad", () => {
    expect(formatUcatPercentile(420, "section")).toBe("<20th percentile");
    expect(formatUcatPercentile(700, "section")).toBe("80th percentile");
  });

  it("returns no percentile for a missing score", () => {
    expect(getUcatPercentile(null, "section")).toBeNull();
    expect(formatUcatPercentile(undefined, "mock")).toBeNull();
  });
});
