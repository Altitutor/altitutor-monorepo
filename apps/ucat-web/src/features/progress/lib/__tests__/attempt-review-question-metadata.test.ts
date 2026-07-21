import { calculateSuccessfulQuestionTiming } from "../attempt-review-question-metadata";

describe("calculateSuccessfulQuestionTiming", () => {
  it("averages only full-mark attempts with valid timing", () => {
    const timing = calculateSuccessfulQuestionTiming(
      [{ id: "mc", question_type: "multiple_choice" }],
      [
        { question_id: "mc", time_spent_seconds: 40, score: 1 },
        { question_id: "mc", time_spent_seconds: 50, score: 1 },
        { question_id: "mc", time_spent_seconds: 60, score: 1 },
        { question_id: "mc", time_spent_seconds: 70, score: 1 },
        { question_id: "mc", time_spent_seconds: 80, score: 1 },
        { question_id: "mc", time_spent_seconds: 10, score: 0 },
        { question_id: "mc", time_spent_seconds: 0, score: 1 },
      ],
    );

    expect(timing.get("mc")).toEqual({
      averageTimeSeconds: 60,
      sampleSize: 5,
    });
  });

  it("does not count partial-credit syllogism attempts as successful", () => {
    const timing = calculateSuccessfulQuestionTiming(
      [{ id: "syllogism", question_type: "syllogism" }],
      [
        { question_id: "syllogism", time_spent_seconds: 30, score: 1 },
        { question_id: "syllogism", time_spent_seconds: 40, score: 2 },
        { question_id: "syllogism", time_spent_seconds: 50, score: 2 },
        { question_id: "syllogism", time_spent_seconds: 60, score: 2 },
        { question_id: "syllogism", time_spent_seconds: 70, score: 2 },
        { question_id: "syllogism", time_spent_seconds: 80, score: 2 },
      ],
    );

    expect(timing.get("syllogism")).toEqual({
      averageTimeSeconds: 60,
      sampleSize: 5,
    });
  });

  it("withholds the average until five successful attempts exist", () => {
    const timing = calculateSuccessfulQuestionTiming(
      [{ id: "mc", question_type: "multiple_choice" }],
      [
        { question_id: "mc", time_spent_seconds: 40, score: 1 },
        { question_id: "mc", time_spent_seconds: 50, score: 1 },
        { question_id: "mc", time_spent_seconds: 60, score: 1 },
        { question_id: "mc", time_spent_seconds: 70, score: 1 },
      ],
    );

    expect(timing.get("mc")).toEqual({
      averageTimeSeconds: null,
      sampleSize: 4,
    });
  });
});
