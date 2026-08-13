import {
  TARGET_SCORE_MAX,
  TARGET_SCORE_MIN,
  normalizeTargetScoreDraft,
  parseTargetScore,
  roundTargetScore,
  validateTargetScore,
} from "@/features/study-plan/lib/target-score";

describe("roundTargetScore", () => {
  it("rounds to the nearest 10", () => {
    expect(roundTargetScore(2104)).toBe(2100);
    expect(roundTargetScore(2105)).toBe(2110);
  });

  it("clamps to the allowed range", () => {
    expect(roundTargetScore(895)).toBe(TARGET_SCORE_MIN);
    expect(roundTargetScore(2705)).toBe(TARGET_SCORE_MAX);
  });
});

describe("validateTargetScore", () => {
  it("accepts valid scores in range", () => {
    expect(validateTargetScore(2100)).toBeNull();
    expect(validateTargetScore("2450")).toBeNull();
    expect(validateTargetScore(2105)).toBeNull();
  });

  it("rejects empty values", () => {
    expect(validateTargetScore("")).toBe("Enter a target score.");
  });

  it("rejects out-of-range scores", () => {
    expect(validateTargetScore(899)).toBe(
      `Target score must be between ${TARGET_SCORE_MIN} and ${TARGET_SCORE_MAX}.`,
    );
    expect(validateTargetScore(2701)).toBe(
      `Target score must be between ${TARGET_SCORE_MIN} and ${TARGET_SCORE_MAX}.`,
    );
  });
});

describe("normalizeTargetScoreDraft", () => {
  it("rounds valid drafts to the nearest 10", () => {
    expect(normalizeTargetScoreDraft("2105")).toEqual({
      value: 2110,
      error: null,
    });
  });
});

describe("parseTargetScore", () => {
  it("returns rounded score when valid", () => {
    expect(parseTargetScore("2205")).toBe(2210);
  });

  it("returns null when invalid", () => {
    expect(parseTargetScore("abc")).toBeNull();
  });
});
