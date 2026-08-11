import type { ReviewContract } from "@altitutor/ucat-response-contract";
import type { QuestionItem } from "@/features/question-engine/model/types";
import { getWrongAnswerExplanations } from "../question-insight-evidence";

function questionWithExplanations(): QuestionItem {
  return {
    id: "question-1",
    index: 0,
    questionSetId: "set-1",
    stemId: "stem-1",
    sectionName: "Decision Making",
    sectionDisplayColumns: 1,
    stemText: "Stem",
    questionText: "Question",
    questionType: "multiple_choice",
    options: [
      { id: "option-a", index: 0, text: "A", isAnswer: true },
      {
        id: "option-b",
        index: 1,
        text: "B",
        answerExplanation: "  B assumes a fact that was not provided.  ",
      },
      {
        id: "option-c",
        index: 2,
        text: "C",
        answerExplanation: "C contradicts the final condition.",
      },
    ],
  };
}

describe("getWrongAnswerExplanations", () => {
  it("returns the selected option explanation for a wrong single-select response", () => {
    const review: ReviewContract = {
      kind: "single_select",
      selectedOptionId: "option-b",
      correctOptionId: "option-a",
      outcome: "incorrect",
    };

    expect(
      getWrongAnswerExplanations(questionWithExplanations(), review),
    ).toEqual(["B assumes a fact that was not provided."]);
  });

  it("returns every explained wrong statement for a partial placement response", () => {
    const review: ReviewContract = {
      kind: "placement",
      outcome: "partial",
      rows: [
        {
          targetId: "option-a",
          placedToken: "yes",
          correctToken: "yes",
          outcome: "correct",
        },
        {
          targetId: "option-b",
          placedToken: "yes",
          correctToken: "no",
          outcome: "incorrect",
        },
        {
          targetId: "option-c",
          placedToken: "no",
          correctToken: "yes",
          outcome: "incorrect",
        },
      ],
    };

    expect(
      getWrongAnswerExplanations(questionWithExplanations(), review),
    ).toEqual([
      "B assumes a fact that was not provided.",
      "C contradicts the final condition.",
    ]);
  });

  it("returns an empty list when the wrong option has no authored explanation", () => {
    const review: ReviewContract = {
      kind: "single_select",
      selectedOptionId: "option-a",
      correctOptionId: "option-b",
      outcome: "incorrect",
    };

    expect(
      getWrongAnswerExplanations(questionWithExplanations(), review),
    ).toEqual([]);
  });
});
