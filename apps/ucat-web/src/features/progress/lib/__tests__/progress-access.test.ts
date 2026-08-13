import {
  hasCompletedQuestion,
  requiresCompletedQuestion,
} from "@/features/progress/lib/progress-access";
import type { SectionProgress } from "@altitutor/shared";

function section(maxScore: number): SectionProgress {
  return {
    sectionId: "section-1",
    sectionName: "Verbal Reasoning",
    sectionNumber: 1,
    correctScore: 0,
    maxScore,
    percentage: 0,
  };
}

describe("progress access", () => {
  it.each([
    "/progress",
    "/progress/sections/1",
    "/progress/mocks",
    "/progress/practice-sessions/attempt-1",
  ])("requires evidence on %s", (pathname) => {
    expect(requiresCompletedQuestion(pathname)).toBe(true);
  });

  it.each([
    "/practice",
    "/progress/preview",
    "/progress/preview/example",
    "/progress/attempts/preview",
  ])("does not gate %s", (pathname) => {
    expect(requiresCompletedQuestion(pathname)).toBe(false);
  });

  it("accepts an attempted question even when no points were scored", () => {
    expect(hasCompletedQuestion([section(1)])).toBe(true);
  });

  it("rejects progress with no attempted questions", () => {
    expect(hasCompletedQuestion([section(0), section(0)])).toBe(false);
  });
});
