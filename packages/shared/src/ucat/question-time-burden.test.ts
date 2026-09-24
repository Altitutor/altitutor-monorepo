import {
  isValidUcatQuestionTimeBurden,
  UCAT_QUESTION_TIME_BURDEN_DEFINITION,
} from "./question-time-burden";

describe("UCAT question time burden", () => {
  it("defines first-exposure, correct-answer timing in authored stem order", () => {
    expect(UCAT_QUESTION_TIME_BURDEN_DEFINITION).toContain("fully correct answer");
    expect(UCAT_QUESTION_TIME_BURDEN_DEFINITION).toContain("first exposure");
    expect(UCAT_QUESTION_TIME_BURDEN_DEFINITION).toContain("authored position");
  });

  it("accepts only positive whole seconds or an unknown value", () => {
    expect(isValidUcatQuestionTimeBurden(null)).toBe(true);
    expect(isValidUcatQuestionTimeBurden(undefined)).toBe(true);
    expect(isValidUcatQuestionTimeBurden(1)).toBe(true);
    expect(isValidUcatQuestionTimeBurden(90)).toBe(true);
    expect(isValidUcatQuestionTimeBurden(0)).toBe(false);
    expect(isValidUcatQuestionTimeBurden(-1)).toBe(false);
    expect(isValidUcatQuestionTimeBurden(1.5)).toBe(false);
  });
});
