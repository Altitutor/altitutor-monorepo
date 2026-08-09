import {
  computeQuestionProgressPoints,
  progressPointsForQuestion,
} from "../progress-points";

describe("Answer-scheme progress points", () => {
  it("sums evaluator maximums without category or Response type weighting", () => {
    expect(
      computeQuestionProgressPoints([
        {
          id: "choice",
          stemId: "shared-stem",
          questionType: "syllogism",
          answerScheme: "single_choice",
        },
        {
          id: "dm",
          stemId: "shared-stem",
          questionType: "multiple_choice",
          answerScheme: "decision_making_binary_placement",
        },
        {
          id: "most-least",
          stemId: "other-stem",
          questionType: "multiple_choice",
          answerScheme: "situational_judgement_most_least",
        },
      ]),
    ).toBe(11);
  });

  it("counts each canonical question independently", () => {
    const countedLegacyStems = new Set<string>();
    expect(
      progressPointsForQuestion(
        {
          id: "dm",
          stemId: "stem",
          questionType: "syllogism",
          answerScheme: "decision_making_binary_placement",
        },
        countedLegacyStems,
      ),
    ).toBe(2);
  });
});
