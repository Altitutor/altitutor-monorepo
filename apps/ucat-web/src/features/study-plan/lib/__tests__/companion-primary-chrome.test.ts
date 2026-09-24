import { describeCompanionPrimaryChrome } from "@/features/study-plan/lib/companion-primary-chrome";

describe("describeCompanionPrimaryChrome", () => {
  it("uses the alternative item’s own task type for eyebrow and CTA", () => {
    expect(
      describeCompanionPrimaryChrome({
        taskType: "section_benchmark",
        planTaskStatus: null,
        isAlternative: true,
      }),
    ).toEqual({
      eyebrow: "Best next step",
      primaryLabel: "Start",
    });
  });

  it("keeps review chrome only for review alternatives", () => {
    expect(
      describeCompanionPrimaryChrome({
        taskType: "review",
        planTaskStatus: null,
        isAlternative: true,
      }),
    ).toEqual({
      eyebrow: "Most useful now",
      primaryLabel: "Review result",
    });
  });

  it("preserves study-plan task chrome when not an alternative", () => {
    expect(
      describeCompanionPrimaryChrome({
        taskType: "practice",
        planTaskStatus: "planned",
        fromEarlierStudyDay: true,
        isAlternative: false,
      }),
    ).toEqual({
      eyebrow: "Still to do",
      primaryLabel: "Start today’s task",
    });
  });
});
