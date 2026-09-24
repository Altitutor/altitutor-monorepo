import { splitPassageSentences } from "../skill-trainer/passage";

jest.mock("@altitutor/shared", () => ({
  extractSkillTrainerPlainText: jest.fn(),
}));

describe("splitPassageSentences", () => {
  it("splits sentence-ending punctuation without regex lookbehind", () => {
    expect(
      splitPassageSentences("First sentence. Second question? Final answer!"),
    ).toEqual(["First sentence.", "Second question?", "Final answer!"]);
  });

  it("keeps adjacent punctuation with its sentence", () => {
    expect(splitPassageSentences("Really?! Yes.")).toEqual([
      "Really?!",
      "Yes.",
    ]);
  });
});
