import { GUIDED_SAMPLER_SECTIONS } from "@/features/signup-onboarding/lib/guided-sampler-questions";

describe("guided UCAT sampler", () => {
  it("covers all four sections sequentially with two questions each", () => {
    expect(GUIDED_SAMPLER_SECTIONS.map((section) => section.key)).toEqual([
      "vr",
      "dm",
      "qr",
      "sjt",
    ]);
    expect(
      GUIDED_SAMPLER_SECTIONS.every(
        (section) => section.questions.length === 2,
      ),
    ).toBe(true);
  });

  it("contains one marked answer and unique IDs for every question", () => {
    const questions = GUIDED_SAMPLER_SECTIONS.flatMap(
      (section) => section.questions,
    );
    expect(new Set(questions.map((question) => question.id)).size).toBe(
      questions.length,
    );
    for (const question of questions) {
      expect(question.options.filter((option) => option.isAnswer)).toHaveLength(
        1,
      );
    }
  });
});
