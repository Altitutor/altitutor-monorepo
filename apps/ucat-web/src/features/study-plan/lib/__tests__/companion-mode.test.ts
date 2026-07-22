import {
  getStudyPlanCompanionMode,
  isAlreadyOnSuggestedActivity,
} from "@/features/study-plan/lib/companion-mode";

describe("Study Plan companion route mode", () => {
  it.each([
    "/practice/session",
    "/practice/stem/stem-1",
    "/exam/sets",
    "/exam/mocks",
  ])("hides during fullscreen attempt route %s", (pathname) => {
    expect(getStudyPlanCompanionMode(pathname)).toBe("hidden");
  });

  it.each([
    "/skill-trainer/quick-syllogism/play",
    "/learn/module-1",
    "/learn/sections/2/module-1",
    "/progress/set-attempts/attempt-1",
    "/progress/sections/2/set-attempts/attempt-1",
    "/progress/practice-sessions/session-1",
    "/progress/mocks/mock-attempts/mock-1",
  ])("stays silent on in-progress activity route %s", (pathname) => {
    expect(getStudyPlanCompanionMode(pathname)).toBe("activity");
  });

  it.each([
    "/skill-trainer",
    "/sets",
    "/sets/sections/2",
    "/mocks",
    "/learn",
    "/learn/sections",
    "/learn/sections/2",
    "/progress",
    "/settings/plan",
    "/practice",
    "/skill-trainer/quick-syllogism",
    "/mocks/mock-1",
    "/sets/set-1",
    "/sets/sections/2/set-1",
    "/sessions/session-1/sets/set-1",
    "/sessions/session-1/mocks/mock-1",
    "/dashboard",
    "/study-plan",
  ])("remains available on browsing route %s", (pathname) => {
    expect(getStudyPlanCompanionMode(pathname)).toBe("available");
  });
});

describe("isAlreadyOnSuggestedActivity", () => {
  it("matches the exact suggested path", () => {
    expect(
      isAlreadyOnSuggestedActivity(
        "/progress/set-attempts/attempt-1",
        "/progress/set-attempts/attempt-1",
      ),
    ).toBe(true);
  });

  it("matches section-scoped set review against the canonical review path", () => {
    expect(
      isAlreadyOnSuggestedActivity(
        "/progress/sections/2/set-attempts/attempt-1",
        "/progress/set-attempts/attempt-1",
      ),
    ).toBe(true);
  });

  it("does not match unrelated routes that share a leaf id", () => {
    expect(
      isAlreadyOnSuggestedActivity(
        "/sets/attempt-1",
        "/progress/set-attempts/attempt-1",
      ),
    ).toBe(false);
  });
});
