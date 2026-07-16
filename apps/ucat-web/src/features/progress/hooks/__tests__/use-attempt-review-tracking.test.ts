import { findNextUnviewedReviewQuestion } from "../use-attempt-review-tracking";

describe("findNextUnviewedReviewQuestion", () => {
  it("advances from the selected question and wraps around", () => {
    expect(
      findNextUnviewedReviewQuestion({
        requiredQuestionIds: ["q1", "q2", "q3"],
        viewedQuestionIds: ["q2"],
        selectedQuestionId: "q2",
      }),
    ).toBe("q3");

    expect(
      findNextUnviewedReviewQuestion({
        requiredQuestionIds: ["q1", "q2", "q3"],
        viewedQuestionIds: ["q2", "q3"],
        selectedQuestionId: "q3",
      }),
    ).toBe("q1");
  });

  it("returns null after every required question has been viewed", () => {
    expect(
      findNextUnviewedReviewQuestion({
        requiredQuestionIds: ["q1", "q2"],
        viewedQuestionIds: ["q1", "q2"],
        selectedQuestionId: "q2",
      }),
    ).toBeNull();
  });
});
