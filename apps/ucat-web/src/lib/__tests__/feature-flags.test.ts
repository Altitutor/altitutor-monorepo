import { isSetGeneratorPath } from "@/lib/feature-flags";

describe("isSetGeneratorPath", () => {
  it("matches set generator routes", () => {
    expect(isSetGeneratorPath("/set-generator")).toBe(true);
    expect(isSetGeneratorPath("/sets/set-generator")).toBe(true);
    expect(isSetGeneratorPath("/sets/set-generator/abc-123")).toBe(true);
  });

  it("does not match other sets routes", () => {
    expect(isSetGeneratorPath("/sets")).toBe(false);
    expect(isSetGeneratorPath("/sets/sections/1")).toBe(false);
  });
});
