import {
  getAutoStartTourForPathname,
  UCAT_ATTEMPT_REVIEW_TOUR,
  UCAT_DASHBOARD_TOUR,
  UCAT_LEARN_TOUR,
  UCAT_MOCKS_TOUR,
  UCAT_PRACTICE_TOUR,
  UCAT_PROGRESS_TOUR,
  UCAT_QUESTION_ENGINE_TOUR,
  UCAT_SECTION_PROGRESS_TOUR,
  UCAT_SETS_TOUR,
  UCAT_SKILL_TRAINER_TOUR,
  UCAT_STUDY_PLAN_TOUR,
} from "@/features/onboarding/config/tour-catalog";

describe("contextual app tutorial routing", () => {
  it.each([
    ["/dashboard", UCAT_DASHBOARD_TOUR],
    ["/study-plan", UCAT_STUDY_PLAN_TOUR],
    ["/progress", UCAT_PROGRESS_TOUR],
    ["/learn", UCAT_LEARN_TOUR],
    ["/skill-trainer", UCAT_SKILL_TRAINER_TOUR],
    ["/practice", UCAT_PRACTICE_TOUR],
    ["/sets", UCAT_SETS_TOUR],
    ["/mocks", UCAT_MOCKS_TOUR],
    ["/exam/tutorial", UCAT_QUESTION_ENGINE_TOUR],
  ])("maps %s to its first-visit tutorial", (pathname, expectedTour) => {
    expect(getAutoStartTourForPathname(pathname)).toBe(expectedTour);
  });

  it("shares one tutorial across every section progress page", () => {
    expect(getAutoStartTourForPathname("/progress/sections/1")).toBe(
      UCAT_SECTION_PROGRESS_TOUR,
    );
    expect(getAutoStartTourForPathname("/progress/sections/4")).toBe(
      UCAT_SECTION_PROGRESS_TOUR,
    );
  });

  it.each([
    "/progress/practice-sessions/practice-1",
    "/progress/set-attempts/set-1",
    "/progress/sections/2/set-attempts/set-2",
    "/progress/mock-attempts/mock-1",
    "/progress/mock-attempts/mock-1/sets/set-3",
    "/progress/mocks/mock-attempts/mock-2",
    "/progress/mocks/mock-attempts/mock-2/set-attempts/set-4",
  ])("shares one results tutorial for %s", (pathname) => {
    expect(getAutoStartTourForPathname(pathname)).toBe(
      UCAT_ATTEMPT_REVIEW_TOUR,
    );
  });

  it.each([
    "/sessions",
    "/learn/general/module-1",
    "/learn/sections/1/module-2",
    "/sets/sections/1",
    "/settings/app",
  ])("does not auto-start an unrequested tutorial on %s", (pathname) => {
    expect(getAutoStartTourForPathname(pathname)).toBeNull();
  });
});
