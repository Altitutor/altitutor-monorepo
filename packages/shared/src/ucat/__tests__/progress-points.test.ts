import {
  computeQuestionProgressPoints,
  progressPointsForQuestion,
} from "../progress-points";

describe("Answer-scheme progress points", () => {
  it("uses Answer-scheme progress weights without category or Response type weighting", () => {
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
          id: "dm-legacy-row-2",
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
    ).toBe(4);
  });

  it("counts grouped Decision Making rows once per stem", () => {
    const countedGroupedQuestionIds = new Set<string>();
    expect(
      progressPointsForQuestion(
        {
          id: "dm",
          stemId: "stem",
          questionType: "syllogism",
          answerScheme: "decision_making_binary_placement",
        },
        countedGroupedQuestionIds,
      ),
    ).toBe(2);
    expect(
      progressPointsForQuestion(
        {
          id: "dm-legacy-row-2",
          stemId: "stem",
          questionType: "multiple_choice",
          answerScheme: "decision_making_binary_placement",
        },
        countedGroupedQuestionIds,
      ),
    ).toBe(0);
  });
});
