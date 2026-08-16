/**
 * Tests for review utilities
 */

import {
  getReviewQuestionStatus,
  getReviewFilterIndices,
  getIncompleteCount,
} from "../review";
import type { QuestionItem } from "@/features/question-engine/model/types";

function createQuestion(id: string, index: number): QuestionItem {
  return {
    id,
    index,
    questionSetId: "set-1",
    stemId: "stem-1",
    sectionName: "Section",
    sectionDisplayColumns: 1,
    stemText: "",
    questionText: "",
    responseType: "multiple_choice",
    answerScheme: "single_choice",
    options: ["a", "b", "c", "opt-a", "opt-b"].map((optionId, optionIndex) => ({
      id: optionId,
      index: optionIndex,
      text: "",
      answerKeyValue: optionId === "a" ? "correct" : null,
    })),
  };
}

describe("getReviewQuestionStatus", () => {
  it('returns "complete" when question has an answer', () => {
    const q = createQuestion("q1", 0);
    expect(getReviewQuestionStatus(q, [], { q1: "opt-a" })).toBe("complete");
  });

  it('returns "incomplete" when visited but not answered', () => {
    const q = createQuestion("q1", 0);
    expect(getReviewQuestionStatus(q, ["q1"], {})).toBe("incomplete");
  });

  it('returns "unseen" when not visited and not answered', () => {
    const q = createQuestion("q1", 0);
    expect(getReviewQuestionStatus(q, [], {})).toBe("unseen");
  });

  it("marks placement complete only when all options answered", () => {
    const q: QuestionItem = {
      ...createQuestion("syllo-1", 0),
      responseType: "drag_and_drop",
      answerScheme: "decision_making_binary_placement",
      options: [
        { id: "o1", index: 0, text: "", answerKeyValue: "yes" },
        { id: "o2", index: 1, text: "", answerKeyValue: "no" },
        { id: "o3", index: 2, text: "", answerKeyValue: "yes" },
        { id: "o4", index: 3, text: "", answerKeyValue: "no" },
        { id: "o5", index: 4, text: "", answerKeyValue: "yes" },
      ],
    };

    // Partially answered: incomplete
    expect(
      getReviewQuestionStatus(
        q,
        ["syllo-1"],
        {},
        { "syllo-1": { o1: "yes", o2: "no" } },
      ),
    ).toBe("incomplete");

    // All answered: complete
    expect(
      getReviewQuestionStatus(
        q,
        ["syllo-1"],
        {},
        { "syllo-1": { o1: "yes", o2: "no", o3: "yes", o4: "no", o5: "yes" } },
      ),
    ).toBe("complete");
  });
});

describe("getReviewFilterIndices", () => {
  const questions = [
    createQuestion("q1", 0),
    createQuestion("q2", 1),
    createQuestion("q3", 2),
  ];

  it('returns all indices for "all" filter', () => {
    expect(getReviewFilterIndices(questions, "all", [], {}, [])).toEqual([
      0, 1, 2,
    ]);
  });

  it('returns only incomplete/unseen for "incomplete" filter', () => {
    expect(
      getReviewFilterIndices(
        questions,
        "incomplete",
        ["q1"],
        { q2: "opt-b" },
        [],
        undefined,
      ),
    ).toEqual([0, 2]);
  });

  it('returns only flagged indices for "flagged" filter', () => {
    expect(
      getReviewFilterIndices(
        questions,
        "flagged",
        [],
        {},
        ["q1", "q3"],
        undefined,
      ),
    ).toEqual([0, 2]);
  });
});

describe("getIncompleteCount", () => {
  const questions = [
    createQuestion("q1", 0),
    createQuestion("q2", 1),
    createQuestion("q3", 2),
  ];

  it("returns 0 when all answered", () => {
    expect(
      getIncompleteCount(questions, [], { q1: "a", q2: "b", q3: "c" }),
    ).toBe(0);
  });

  it("returns 3 when none answered", () => {
    expect(getIncompleteCount(questions, [], {})).toBe(3);
  });
});
