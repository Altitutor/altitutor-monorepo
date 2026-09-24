import {
  buildQuestionEngineTutorialHref,
  getQuestionEngineTutorialKind,
  isQuestionEnginePath,
  isQuestionEngineTutorialSatisfied,
} from "@/features/onboarding/lib/question-engine-tutorial-gate";

describe("question engine tutorial gate helpers", () => {
  it("builds a safe tutorial href with returnTo", () => {
    expect(buildQuestionEngineTutorialHref("/practice", "full")).toBe(
      "/exam/tutorial?returnTo=%2Fpractice",
    );
    expect(buildQuestionEngineTutorialHref("/sets/abc", "controls")).toBe(
      "/exam/controls-tutorial?returnTo=%2Fsets%2Fabc",
    );
    expect(buildQuestionEngineTutorialHref("/mocks/abc", "choose")).toBe(
      "/question-interface/tutorial?returnTo=%2Fmocks%2Fabc",
    );
  });

  it("rejects unsafe returnTo values", () => {
    expect(
      buildQuestionEngineTutorialHref("https://evil.example", "full"),
    ).toBe("/exam/tutorial?returnTo=%2Fdashboard");
    expect(buildQuestionEngineTutorialHref("//evil.example", "full")).toBe(
      "/exam/tutorial?returnTo=%2Fdashboard",
    );
  });

  it("selects guidance from UCAT familiarity rather than sampler completion", () => {
    expect(getQuestionEngineTutorialKind("new")).toBe("full");
    expect(getQuestionEngineTutorialKind("familiar")).toBe("full");
    expect(getQuestionEngineTutorialKind("experienced")).toBe("controls");
    expect(getQuestionEngineTutorialKind(null)).toBe("choose");
    expect(getQuestionEngineTutorialKind("unexpected")).toBe("choose");
  });

  it("treats either question-interface tutorial as complete for every familiarity", () => {
    const fullCompleted = (tourId: string) =>
      tourId === "ucat-question-engine-intro";
    const controlsCompleted = (tourId: string) =>
      tourId === "ucat-question-engine-controls-intro";

    expect(isQuestionEngineTutorialSatisfied(fullCompleted)).toBe(true);
    expect(isQuestionEngineTutorialSatisfied(controlsCompleted)).toBe(true);
    expect(isQuestionEngineTutorialSatisfied(() => false)).toBe(false);
  });

  it("detects question-engine routes that require the tutorial", () => {
    expect(isQuestionEnginePath("/exam")).toBe(true);
    expect(isQuestionEnginePath("/exam/tutorial")).toBe(false);
    expect(isQuestionEnginePath("/practice")).toBe(false);
    expect(isQuestionEnginePath("/dashboard")).toBe(false);
  });
});
