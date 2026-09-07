import type { ReviewContract } from "@altitutor/ucat-response-contract";
import type { QuestionItem } from "@/features/question-engine/model/types";
import { getWrongAnswerInsightItems } from "../question-insight-evidence";

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
    options: [
      { id: "option-a", index: 0, text: "A", answerKeyValue: "correct" },
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

function mostLeastQuestion(): QuestionItem {
  return {
    id: "question-3",
    index: 2,
    questionSetId: "set-1",
    stemId: "stem-1",
    sectionName: "Situational Judgement",
    sectionDisplayColumns: 1,
    stemText: "test most least",
    questionText: "question most least",
    responseType: "drag_and_drop",
    answerScheme: "situational_judgement_most_least",
    options: [
      {
        id: "most-option",
        index: 0,
        text: "most",
        answerKeyValue: "most",
        answerExplanation: "test1",
      },
      {
        id: "least-option",
        index: 1,
        text: "jleast",
        answerKeyValue: "least",
        answerExplanation: "test2",
      },
      {
        id: "middle-option",
        index: 2,
        text: "none",
        answerKeyValue: null,
        answerExplanation: "test 3",
      },
    ],
  };
}

function binaryPlacementQuestion(): QuestionItem {
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
    options: [
      { id: "option-a", index: 0, text: "Statement A", answerKeyValue: "yes" },
      {
        id: "option-b",
        index: 1,
        text: "Statement B",
        answerKeyValue: "no",
        answerExplanation: "  B assumes a fact that was not provided.  ",
      },
      {
        id: "option-c",
        index: 2,
        text: "Statement C",
        answerKeyValue: "yes",
        answerExplanation: "C contradicts the final condition.",
      },
      { id: "option-d", index: 3, text: "Statement D", answerKeyValue: "no" },
    ],
  };
}

describe("getWrongAnswerInsightItems", () => {
  it("returns the chosen multiple-choice option when it has an explanation", () => {
    const review: ReviewContract = {
      kind: "single_select",
      selectedOptionId: "option-b",
      correctOptionId: "option-a",
      outcome: "incorrect",
    };

    expect(getWrongAnswerInsightItems(multipleChoiceQuestion(), review)).toEqual(
      [
        {
          kind: "single_select",
          option: multipleChoiceQuestion().options[1],
          letter: "B",
        },
      ],
    );
  });

  it("returns every explained wrong placement, with the token the student chose", () => {
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
        {
          targetId: "option-d",
          placedToken: "yes",
          correctToken: "no",
          outcome: "incorrect",
        },
      ],
    };

    expect(
      getWrongAnswerInsightItems(binaryPlacementQuestion(), review),
    ).toEqual([
      {
        kind: "placement",
        option: binaryPlacementQuestion().options[1],
        chosenTokenLabel: "Yes",
      },
      {
        kind: "placement",
        option: binaryPlacementQuestion().options[2],
        chosenTokenLabel: "No",
      },
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
      getWrongAnswerInsightItems(multipleChoiceQuestion(), review),
    ).toEqual([]);
  });

  it("does not use a correct multiple-choice selection as insight evidence", () => {
    const review: ReviewContract = {
      kind: "single_select",
      selectedOptionId: "option-b",
      correctOptionId: "option-b",
      outcome: "correct",
    };

    expect(
      getWrongAnswerInsightItems(multipleChoiceQuestion(), review),
    ).toEqual([]);
  });

  it("includes a required Most/Least option that was left unplaced", () => {
    const review: ReviewContract = {
      kind: "placement",
      outcome: "partial",
      rows: [
        {
          targetId: "most-option",
          placedToken: "most",
          correctToken: "most",
          outcome: "correct",
        },
        {
          targetId: "least-option",
          placedToken: null,
          correctToken: "least",
          outcome: "unanswered",
        },
        {
          targetId: "middle-option",
          placedToken: "least",
          correctToken: null,
          outcome: "incorrect",
        },
      ],
    };

    expect(getWrongAnswerInsightItems(mostLeastQuestion(), review)).toEqual([
      {
        kind: "placement",
        option: mostLeastQuestion().options[1],
        chosenTokenLabel: null,
      },
      {
        kind: "placement",
        option: mostLeastQuestion().options[2],
        chosenTokenLabel: "Least Appropriate",
      },
    ]);
  });

  it("does not treat a correctly unplaced middle action as a miss", () => {
    const review: ReviewContract = {
      kind: "placement",
      outcome: "correct",
      rows: [
        {
          targetId: "most-option",
          placedToken: "most",
          correctToken: "most",
          outcome: "correct",
        },
        {
          targetId: "least-option",
          placedToken: "least",
          correctToken: "least",
          outcome: "correct",
        },
        {
          targetId: "middle-option",
          placedToken: null,
          correctToken: null,
          outcome: "unanswered",
        },
      ],
    };

    expect(getWrongAnswerInsightItems(mostLeastQuestion(), review)).toEqual([]);
  });
});
