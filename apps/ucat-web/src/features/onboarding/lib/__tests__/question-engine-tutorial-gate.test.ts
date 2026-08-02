import {
  buildQuestionEngineTutorialHref,
  isQuestionEnginePath,
} from "@/features/onboarding/lib/question-engine-tutorial-gate";

describe("question engine tutorial gate helpers", () => {
  it("builds a safe tutorial href with returnTo", () => {
    expect(buildQuestionEngineTutorialHref("/practice")).toBe(
      "/exam/tutorial?returnTo=%2Fpractice",
    );
    expect(buildQuestionEngineTutorialHref("/sets/abc")).toBe(
      "/exam/tutorial?returnTo=%2Fsets%2Fabc",
    );
  });

  it("rejects unsafe returnTo values", () => {
    expect(buildQuestionEngineTutorialHref("https://evil.example")).toBe(
      "/exam/tutorial?returnTo=%2Fdashboard",
    );
    expect(buildQuestionEngineTutorialHref("//evil.example")).toBe(
      "/exam/tutorial?returnTo=%2Fdashboard",
    );
  });

  it("detects question-engine routes that require the tutorial", () => {
    expect(isQuestionEnginePath("/exam")).toBe(true);
    expect(isQuestionEnginePath("/exam/tutorial")).toBe(false);
    expect(isQuestionEnginePath("/practice")).toBe(false);
    expect(isQuestionEnginePath("/dashboard")).toBe(false);
  });
});
