import {
  formatSpeedMultiplier,
  formatSpeedPercentAsMultiplier,
} from "../format-speed-multiplier";

describe("speed multiplier formatting", () => {
  it("uses at most two decimals and removes trailing zeroes", () => {
    expect(formatSpeedMultiplier(1.24)).toBe("1.24x");
    expect(formatSpeedMultiplier(2)).toBe("2x");
    expect(formatSpeedMultiplier(0.25)).toBe("0.25x");
    expect(formatSpeedMultiplier(1.2)).toBe("1.2x");
    expect(formatSpeedMultiplier(1.236)).toBe("1.24x");
  });

  it("converts historical percentage values to multipliers", () => {
    expect(formatSpeedPercentAsMultiplier(124)).toBe("1.24x");
    expect(formatSpeedPercentAsMultiplier(200)).toBe("2x");
    expect(formatSpeedPercentAsMultiplier(25)).toBe("0.25x");
  });

  it("uses an em dash when speed is unavailable", () => {
    expect(formatSpeedMultiplier(null)).toBe("—");
    expect(formatSpeedPercentAsMultiplier(undefined)).toBe("—");
  });
});
