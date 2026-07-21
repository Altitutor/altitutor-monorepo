import { getStudyPlanCompanionMode } from "@/features/study-plan/lib/companion-mode";

describe("Study Plan companion route mode", () => {
  it.each([
    "/practice/session",
    "/practice/stem/stem-1",
    "/exam/sets",
    "/exam/mocks",
  ])("hides during active attempt route %s", (pathname) => {
    expect(getStudyPlanCompanionMode(pathname)).toBe("hidden");
  });

  it("lets the Skill Trainer results state control the play route", () => {
    expect(
      getStudyPlanCompanionMode("/skill-trainer/quick-syllogism/play"),
    ).toBe("activity");
  });

  it.each([
    "/skill-trainer",
    "/sets",
    "/sets/sections/2",
    "/mocks",
    "/learn",
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
