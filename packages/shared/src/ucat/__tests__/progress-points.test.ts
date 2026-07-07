import {
  computeQuestionProgressPoints,
  progressPointsForQuestion,
} from "../progress-points";

describe("computeQuestionProgressPoints", () => {
  it("counts one point per non-syllogism question", () => {
    const points = computeQuestionProgressPoints([
      { id: "q1", stemId: "stem-a", questionType: "multiple_choice" },
      { id: "q2", stemId: "stem-a", questionType: "multiple_choice" },
      { id: "q3", stemId: "stem-b", questionType: "multiple_choice" },
    ]);
    expect(points).toBe(3);
  });

  it("counts a syllogism stem as two points once", () => {
    const stemId = "stem-syllogism";
    const points = computeQuestionProgressPoints([
      { id: "q1", stemId, questionType: "syllogism" },
      { id: "q2", stemId, questionType: "syllogism" },
      { id: "q3", stemId, questionType: "syllogism" },
      { id: "q4", stemId, questionType: "syllogism" },
      { id: "q5", stemId, questionType: "syllogism" },
    ]);
    expect(points).toBe(2);
  });

  it("mixes syllogism stems with regular questions", () => {
    const points = computeQuestionProgressPoints([
      { id: "vr-1", stemId: "vr-stem", questionType: "multiple_choice" },
      { id: "vr-2", stemId: "vr-stem", questionType: "multiple_choice" },
      { id: "vr-3", stemId: "vr-stem", questionType: "multiple_choice" },
      { id: "vr-4", stemId: "vr-stem", questionType: "multiple_choice" },
      { id: "s1", stemId: "dm-syllogism", questionType: "syllogism" },
      { id: "s2", stemId: "dm-syllogism", questionType: "syllogism" },
    ]);
    expect(points).toBe(6);
  });
});

describe("progressPointsForQuestion", () => {
  it("returns zero for repeated syllogism questions in the same stem", () => {
    const counted = new Set<string>();
    const question = { id: "q1", stemId: "stem-1", questionType: "syllogism" };
    expect(progressPointsForQuestion(question, counted)).toBe(2);
    expect(progressPointsForQuestion(
      { id: "q2", stemId: "stem-1", questionType: "syllogism" },
      counted,
    )).toBe(0);
  });
});
