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
    expect(buildQuestionEngineTutorialHref("https://evil.example", "full")).toBe(
      "/exam/tutorial?returnTo=%2Fdashboard",
    );
    expect(buildQuestionEngineTutorialHref("//evil.example", "full")).toBe(
      "/exam/tutorial?returnTo=%2Fdashboard",
    );
  });

  it("selects guidance from UCAT familiarity rather than sampler completion", () => {
    expect(getQuestionEngineTutorialKind("new")).toBe("full");
    expect(getQuestionEngineTutorialKind("familiar")).toBe("controls");
    expect(getQuestionEngineTutorialKind("experienced")).toBe("controls");
    expect(getQuestionEngineTutorialKind(null)).toBe("choose");
    expect(getQuestionEngineTutorialKind("unexpected")).toBe("choose");
  });

  it("accepts the full tutorial as satisfying experienced guidance", () => {
    const completed = (tourId: string) => tourId === "ucat-question-engine-intro";

    expect(isQuestionEngineTutorialSatisfied("controls", completed)).toBe(true);
    expect(isQuestionEngineTutorialSatisfied("choose", completed)).toBe(true);
    expect(isQuestionEngineTutorialSatisfied("full", completed)).toBe(true);
  });

  it("detects question-engine routes that require the tutorial", () => {
    expect(isQuestionEnginePath("/exam")).toBe(true);
    expect(isQuestionEnginePath("/exam/tutorial")).toBe(false);
    expect(isQuestionEnginePath("/practice")).toBe(false);
    expect(isQuestionEnginePath("/dashboard")).toBe(false);
  });
});
