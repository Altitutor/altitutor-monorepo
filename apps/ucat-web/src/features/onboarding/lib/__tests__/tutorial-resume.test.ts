import {
  clearTutorialResume,
  consumeTutorialResume,
  readTutorialResume,
  saveTutorialResume,
} from "@/features/onboarding/lib/tutorial-resume";

describe("tutorial resume session state", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("only consumes a pause on its intended tour and page", () => {
    saveTutorialResume({
      tourId: "ucat-sets-intro",
      stepIndex: 2,
      pathname: "/sets/sections/1",
    });

    expect(consumeTutorialResume("ucat-sets-intro", "/sets")).toBeNull();
    expect(
      consumeTutorialResume("ucat-sets-intro", "/sets/sections/1"),
    ).toEqual({
      tourId: "ucat-sets-intro",
      stepIndex: 2,
      pathname: "/sets/sections/1",
    });
    expect(readTutorialResume()).toBeNull();
  });

  it("discards malformed session state", () => {
    window.sessionStorage.setItem("ucat-contextual-tutorial-resume", "nope");
    expect(readTutorialResume()).toBeNull();
  });

  it("does not clear another tour's pause", () => {
    saveTutorialResume({
      tourId: "ucat-mocks-intro",
      stepIndex: 1,
      pathname: "/mocks/1",
    });
    clearTutorialResume("ucat-dashboard-intro");
    expect(readTutorialResume()?.tourId).toBe("ucat-mocks-intro");
  });

  it("keeps independent pauses for different tutorials", () => {
    saveTutorialResume({
      tourId: "ucat-dashboard-intro",
      stepIndex: 4,
      pathname: "/dashboard",
    });
    saveTutorialResume({
      tourId: "ucat-study-plan-intro",
      stepIndex: 1,
      pathname: "/study-plan",
    });

    expect(readTutorialResume("ucat-dashboard-intro", "/dashboard")).toEqual({
      tourId: "ucat-dashboard-intro",
      stepIndex: 4,
      pathname: "/dashboard",
    });
    expect(
      consumeTutorialResume("ucat-study-plan-intro", "/study-plan"),
    ).toEqual({
      tourId: "ucat-study-plan-intro",
      stepIndex: 1,
      pathname: "/study-plan",
    });
    expect(readTutorialResume("ucat-dashboard-intro", "/dashboard")).not.toBeNull();
  });
});
