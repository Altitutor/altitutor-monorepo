import {
  getStudyPlanCompanionMode,
  isAlreadyOnSuggestedActivity,
} from "@/features/study-plan/lib/companion-mode";

describe("Study Plan companion route mode", () => {
  it.each(["/exam", "/exam/tutorial"])(
    "hides during fullscreen attempt route %s",
    (pathname) => {
      expect(getStudyPlanCompanionMode(pathname)).toBe("hidden");
    },
  );

  it.each([
    "/dashboard/preview",
    "/insights/preview",
    "/onboarding/preview",
    "/progress/preview",
    "/progress/attempts/preview",
    "/study-plan/preview",
  ])("hides on development preview route %s", (pathname) => {
    expect(getStudyPlanCompanionMode(pathname)).toBe("hidden");
  });

  it.each([
    "/skill-trainer/quick-syllogism/play",
    "/learn/module-1",
    "/learn/sections/2/module-1",
  ])("stays silent on in-progress activity route %s", (pathname) => {
    expect(getStudyPlanCompanionMode(pathname)).toBe("activity");
  });

  it.each([
    "/progress/set-attempts/attempt-1",
    "/progress/sections/2/set-attempts/attempt-1",
    "/progress/practice-sessions/session-1",
    "/progress/mocks/mock-attempts/mock-1",
  ])("keeps the orb available on attempt review route %s", (pathname) => {
    expect(getStudyPlanCompanionMode(pathname)).toBe("available");
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
