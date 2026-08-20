import {
  calculatePracticeSessionTimeLimitSeconds,
  getPracticeTimingSummaryLabel,
  resolvePracticeTimingScope,
} from "@/features/practice/model/practice-timing-policy";

describe("resolvePracticeTimingScope", () => {
  it.each([
    {
      label: "untimed fixed review after each stem",
      input: {
        timePerQuestionSeconds: null,
        unlimited: false,
        reviewTiming: "afterEachStem" as const,
      },
      expected: "untimed",
    },
    {
      label: "timed unlimited review after each stem",
      input: {
        timePerQuestionSeconds: 60,
        unlimited: true,
        reviewTiming: "afterEachStem" as const,
      },
      expected: "stem",
    },
    {
      label: "timed fixed review at end",
      input: {
        timePerQuestionSeconds: 60,
        unlimited: false,
        reviewTiming: "atEnd" as const,
      },
      expected: "session",
    },
    {
      label: "timed unlimited review at end",
      input: {
        timePerQuestionSeconds: 60,
        unlimited: true,
        reviewTiming: "atEnd" as const,
      },
      expected: "invalid",
    },
  ])("returns $expected for $label", ({ input, expected }) => {
    expect(resolvePracticeTimingScope(input)).toBe(expected);
  });
});

describe("calculatePracticeSessionTimeLimitSeconds", () => {
  it("uses the delivered question count for the session deadline", () => {
    expect(calculatePracticeSessionTimeLimitSeconds(64, 21)).toBe(1_344);
  });
});

describe("getPracticeTimingSummaryLabel", () => {
  it("describes a fixed review-at-end clock as one total", () => {
    expect(
      getPracticeTimingSummaryLabel({
        timePerQuestionSeconds: 64,
        unlimited: false,
        reviewTiming: "atEnd",
        questionCount: 20,
      }),
    ).toBe("21:20 total (20 questions)");
  });

  it("describes review-as-you-go timing as per stem", () => {
    expect(
      getPracticeTimingSummaryLabel({
        timePerQuestionSeconds: 64,
        unlimited: true,
        reviewTiming: "afterEachStem",
        questionCount: 20,
      }),
    ).toBe("64 sec per question · timed per stem");
  });
});
