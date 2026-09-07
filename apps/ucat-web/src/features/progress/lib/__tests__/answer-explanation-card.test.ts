import type { QuestionItem } from "@/features/question-engine/model/types";
import {
  getAnswerExplanationCardModel,
  shouldShowQuestionExplanationInInsight,
} from "../answer-explanation-card";

function multipleChoiceQuestion(): QuestionItem {
  return {
    id: "question-1",
    index: 0,
    questionSetId: "set-1",
    stemId: "stem-1",
    sectionName: "Decision Making",
    sectionDisplayColumns: 1,
    stemText: "Stem",
    questionText: "Question",
    responseType: "multiple_choice",
    answerScheme: "single_choice",
    answerExplanation: "The conclusion follows from the stated evidence.",
    options: [
      { id: "option-a", index: 0, text: "A", answerKeyValue: "correct" },
      {
        id: "option-b",
        index: 1,
        text: "B",
        answerExplanation: "B assumes a fact that was not provided.",
      },
    ],
  };
}

function dragAndDropQuestion(): QuestionItem {
  return {
    id: "question-2",
    index: 1,
    questionSetId: "set-1",
    stemId: "stem-1",
    sectionName: "Decision Making",
    sectionDisplayColumns: 1,
    stemText: "Stem",
    questionText: "Question",
    responseType: "drag_and_drop",
    answerScheme: "decision_making_binary_placement",
    answerExplanation: "Judge each statement only against the notes.",
    options: [
      {
        id: "option-a",
        index: 0,
        text: "Statement A",
        answerKeyValue: "yes",
        answerExplanation: "A is supported.",
      },
      { id: "option-b", index: 1, text: "Statement B", answerKeyValue: "no" },
      {
        id: "option-c",
        index: 2,
        text: "Statement C",
        answerKeyValue: "yes",
        answerExplanation: "C is supported.",
      },
    ],
  };
}

describe("getAnswerExplanationCardModel", () => {
  it("shows only the question-level explanation for multiple choice", () => {
    expect(getAnswerExplanationCardModel(multipleChoiceQuestion())).toEqual({
      kind: "question",
    });
  });

  it("hides multiple-choice option explanations from the answer card", () => {
    const question = multipleChoiceQuestion();
    question.answerExplanation = undefined;
    expect(getAnswerExplanationCardModel(question)).toEqual({ kind: "empty" });
  });

  it("shows only option explanations for drag and drop", () => {
    expect(getAnswerExplanationCardModel(dragAndDropQuestion())).toEqual({
      kind: "options",
      optionIds: ["option-a", "option-c"],
    });
  });

  it("hides the drag-and-drop question-level explanation from the answer card", () => {
    const question = dragAndDropQuestion();
    question.options = question.options.map((option) => ({
      ...option,
      answerExplanation: undefined,
    }));
    expect(getAnswerExplanationCardModel(question)).toEqual({ kind: "empty" });
  });
});

describe("shouldShowQuestionExplanationInInsight", () => {
  it("shows the drag-and-drop question explanation when the student missed marks", () => {
    expect(
      shouldShowQuestionExplanationInInsight(dragAndDropQuestion(), "partial"),
    ).toBe(true);
  });

  it("does not move a multiple-choice question explanation into the insight", () => {
    expect(
      shouldShowQuestionExplanationInInsight(
        multipleChoiceQuestion(),
        "incorrect",
      ),
    ).toBe(false);
  });
});
