import { findUndeliveredPracticeQuestionIds } from "@/lib/ucat/practice-sessions/authorize-delivered-questions";

describe("findUndeliveredPracticeQuestionIds", () => {
  it("authorizes questions present in the delivered snapshot", () => {
    expect(
      findUndeliveredPracticeQuestionIds(
        [
          {
            id: "stem-1",
            questions: [{ id: "question-1" }, { id: "question-2" }],
          },
        ],
        ["question-1", "question-2"],
      ),
    ).toEqual([]);
  });

  it("rejects questions absent from the delivered snapshot", () => {
    expect(
      findUndeliveredPracticeQuestionIds(
        [{ id: "stem-1", questions: [{ id: "question-1" }] }],
        ["question-1", "question-2", "missing-question"],
      ),
    ).toEqual(["question-2", "missing-question"]);
  });

  it("rejects every question when no rich snapshot was delivered", () => {
    expect(
      findUndeliveredPracticeQuestionIds([{ id: "stem-1" }], ["question-1"]),
    ).toEqual(["question-1"]);
  });
});
