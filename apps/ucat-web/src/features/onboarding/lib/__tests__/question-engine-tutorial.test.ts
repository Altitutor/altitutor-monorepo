import {
  buildQuestionEngineTutorialHref,
  getQuestionEngineTutorialKind,
  isQuestionEngineTutorialSatisfied,
} from "@/features/onboarding/lib/question-engine-tutorial";

describe("optional question engine tutorial helpers", () => {
  it("builds a safe tutorial href with returnTo", () => {
    expect(buildQuestionEngineTutorialHref("/dashboard", "full")).toBe(
      "/exam/tutorial?returnTo=%2Fdashboard",
    );
    expect(buildQuestionEngineTutorialHref("/settings/app", "controls")).toBe(
      "/exam/controls-tutorial?returnTo=%2Fsettings%2Fapp",
    );
    expect(buildQuestionEngineTutorialHref("/dashboard", "choose")).toBe(
      "/question-interface/tutorial?returnTo=%2Fdashboard",
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

  it("selects optional guidance from UCAT familiarity", () => {
    expect(getQuestionEngineTutorialKind("new")).toBe("full");
    expect(getQuestionEngineTutorialKind("familiar")).toBe("full");
    expect(getQuestionEngineTutorialKind("experienced")).toBe("controls");
    expect(getQuestionEngineTutorialKind(null)).toBe("choose");
  });

  it("treats either tutorial as completing the dashboard task", () => {
    expect(
      isQuestionEngineTutorialSatisfied(
        (tourId) => tourId === "ucat-question-engine-intro",
      ),
    ).toBe(true);
    expect(
      isQuestionEngineTutorialSatisfied(
        (tourId) => tourId === "ucat-question-engine-controls-intro",
      ),
    ).toBe(true);
    expect(isQuestionEngineTutorialSatisfied(() => false)).toBe(false);
  });
});
