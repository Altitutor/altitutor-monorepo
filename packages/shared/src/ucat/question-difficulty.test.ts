import {
  formatUcatQuestionDifficulty,
  UCAT_QUESTION_DIFFICULTY_BY_TARGET,
  ucatQuestionDifficultyForTarget,
  ucatQuestionDifficultyPercent,
} from "./question-difficulty";

describe("UCAT question difficulty", () => {
  it("uses larger values for harder qualitative targets", () => {
    expect(UCAT_QUESTION_DIFFICULTY_BY_TARGET.easy).toBeLessThan(
      UCAT_QUESTION_DIFFICULTY_BY_TARGET.medium,
    );
    expect(UCAT_QUESTION_DIFFICULTY_BY_TARGET.medium).toBeLessThan(
      UCAT_QUESTION_DIFFICULTY_BY_TARGET.hard,
    );
  });

  it("converts known targets without inventing a mixed estimate", () => {
    expect(ucatQuestionDifficultyForTarget("easy")).toBe(0.25);
    expect(ucatQuestionDifficultyForTarget("medium")).toBe(0.55);
    expect(ucatQuestionDifficultyForTarget("hard")).toBe(0.82);
    expect(ucatQuestionDifficultyForTarget("mixed")).toBeNull();
    expect(ucatQuestionDifficultyForTarget(undefined)).toBeNull();
  });

  it("formats the canonical proportion-incorrect meaning", () => {
    expect(ucatQuestionDifficultyPercent(0)).toBe(0);
    expect(ucatQuestionDifficultyPercent(0.82)).toBe(82);
    expect(ucatQuestionDifficultyPercent(1)).toBe(100);
    expect(formatUcatQuestionDifficulty(0.82)).toBe("82% expected incorrect");
  });
});
