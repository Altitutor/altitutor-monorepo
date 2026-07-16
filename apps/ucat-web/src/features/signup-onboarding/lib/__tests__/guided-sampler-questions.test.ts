import {
  GUIDED_SAMPLER_FEEDBACK,
  GUIDED_SAMPLER_SECTIONS,
} from "@/features/signup-onboarding/lib/guided-sampler-questions";

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

  it("contains answer keys and unique IDs for every question", () => {
    const questions = GUIDED_SAMPLER_SECTIONS.flatMap(
      (section) => section.questions,
    );
    expect(new Set(questions.map((question) => question.id)).size).toBe(
      questions.length,
    );
    for (const question of questions) {
      if (question.questionType === "syllogism") {
        expect(question.options).toHaveLength(5);
        expect(
          question.options.filter((option) => option.isAnswer),
        ).toHaveLength(2);
      } else {
        expect(
          question.options.filter((option) => option.isAnswer),
        ).toHaveLength(1);
      }
    }
  });

  it("uses two independent DM stems: one syllogism and one non-syllogism", () => {
    const dm = GUIDED_SAMPLER_SECTIONS.find((section) => section.key === "dm");
    expect(dm?.questions.map((question) => question.questionType)).toEqual([
      "syllogism",
      "multiple_choice",
    ]);
    expect(new Set(dm?.questions.map((question) => question.stemId)).size).toBe(
      2,
    );
  });

  it("starts VR with an obvious scannable True, False, Can't tell item", () => {
    const firstVr = GUIDED_SAMPLER_SECTIONS.find(
      (section) => section.key === "vr",
    )?.questions[0];
    expect(firstVr?.options.map((option) => option.text)).toEqual([
      "True",
      "False",
      "Can’t tell",
    ]);
    expect(firstVr?.stemText).toContain("create wildlife habitat");
    expect(firstVr?.options.find((option) => option.isAnswer)?.text).toBe(
      "True",
    );
  });

  it("uses single-column layouts for DM and QR sampler questions", () => {
    for (const key of ["dm", "qr"] as const) {
      const section = GUIDED_SAMPLER_SECTIONS.find((item) => item.key === key);
      expect(
        section?.questions.every(
          (question) => question.sectionDisplayColumns === 1,
        ),
      ).toBe(true);
    }
  });

  it("uses a simple adult-revenue QR opener with distractor explanations", () => {
    const firstQr = GUIDED_SAMPLER_SECTIONS.find(
      (section) => section.key === "qr",
    )?.questions[0];
    expect(firstQr?.questionText).toMatch(/adult admissions/i);
    expect(firstQr?.options.find((option) => option.isAnswer)?.text).toBe(
      "$480",
    );
    expect(
      GUIDED_SAMPLER_FEEDBACK["sampler-qr-1"]?.optionFeedback,
    ).toMatchObject({
      "sampler-qr-1-a": expect.stringContaining("child ticket price"),
      "sampler-qr-1-b": expect.stringContaining("concession price"),
      "sampler-qr-1-d": expect.stringContaining("adult and child"),
    });
  });

  it("marks six cognitive questions and keeps SJT as two guided judgements", () => {
    expect(
      GUIDED_SAMPLER_SECTIONS.filter(
        (section) => section.key !== "sjt",
      ).flatMap((section) => section.questions),
    ).toHaveLength(6);
    expect(
      GUIDED_SAMPLER_SECTIONS.find((section) => section.key === "sjt")
        ?.questions,
    ).toHaveLength(2);
  });

  it("provides an explanation and three progressively revealing hints", () => {
    const questions = GUIDED_SAMPLER_SECTIONS.flatMap(
      (section) => section.questions,
    );
    for (const question of questions) {
      expect(GUIDED_SAMPLER_FEEDBACK[question.id]?.explanation).toBeTruthy();
      expect(GUIDED_SAMPLER_FEEDBACK[question.id]?.hints).toHaveLength(3);
    }
  });
});
