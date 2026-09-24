import {
  getTourStep,
  UCAT_DASHBOARD_TOUR,
  UCAT_LEARN_TOUR,
  UCAT_MOCKS_TOUR,
  UCAT_PROGRESS_TOUR,
  UCAT_QUESTION_ENGINE_CONTROLS_TOUR,
  UCAT_QUESTION_ENGINE_TOUR,
  UCAT_SETS_TOUR,
  UCAT_SKILL_TRAINER_TOUR,
  UCAT_STUDY_PLAN_TOUR,
} from "@/features/onboarding/config/tour-steps";

describe("contextual tutorial page behavior", () => {
  it("starts the dashboard welcome from the top on a compact heading target", () => {
    expect(getTourStep(UCAT_DASHBOARD_TOUR, 0)).toEqual(
      expect.objectContaining({
        selector: "[data-tour='dashboard-welcome-heading']",
        scrollMode: "page-start",
      }),
    );
  });

  it("starts the Skill trainer introduction from the top of the page", () => {
    expect(getTourStep(UCAT_SKILL_TRAINER_TOUR, 0)).toEqual(
      expect.objectContaining({
        selector: "#tour-skill-trainer-page",
        scrollMode: "page-start",
      }),
    );
  });

  it("keeps experienced students on the Altitutor-only engine controls", () => {
    expect(getTourStep(UCAT_QUESTION_ENGINE_CONTROLS_TOUR, 0)).toEqual(
      expect.objectContaining({
        selector: "[data-tour='question-engine-menu']",
        interactionSelector: "[data-tour='question-engine-menu']",
        showControls: false,
      }),
    );
    expect(getTourStep(UCAT_QUESTION_ENGINE_CONTROLS_TOUR, 1)).toEqual(
      expect.objectContaining({
        title: "Explore the Altitutor controls",
        selector: "[data-tour='question-engine-settings']",
        showControls: true,
      }),
    );
    expect(getTourStep(UCAT_QUESTION_ENGINE_CONTROLS_TOUR, 2)).toEqual(
      expect.objectContaining({
        title: "You are ready",
        selector: "[data-tour='tutorial-dim-only']",
        pointerPadding: 0,
        pointerRadius: 0,
      }),
    );
    expect(getTourStep(UCAT_QUESTION_ENGINE_CONTROLS_TOUR, 3)).toBeNull();

    expect(getTourStep(UCAT_QUESTION_ENGINE_TOUR, 2)).toEqual(
      expect.objectContaining({
        selector: "[data-tour='question-engine-calculator']",
      }),
    );
    expect(getTourStep(UCAT_QUESTION_ENGINE_TOUR, 11)).toEqual(
      expect.objectContaining({
        selector: "[data-tour='tutorial-dim-only']",
        pointerPadding: 0,
        pointerRadius: 0,
      }),
    );
  });

  it("spotlights one complete Study plan task instead of an offscreen list", () => {
    expect(getTourStep(UCAT_STUDY_PLAN_TOUR, 1)).toEqual(
      expect.objectContaining({
        selector: "[data-tour='study-plan-task']",
        interactionSelector: "[data-tour-study-plan-task-action]",
        completeOnInteraction: true,
      }),
    );
  });

  it("continues Learn from area selection to the destination module list", () => {
    expect(getTourStep(UCAT_LEARN_TOUR, 1)).toEqual(
      expect.objectContaining({
        interactionSelector: "[data-tour='learn-area-link'] a",
        showControls: false,
      }),
    );
    expect(getTourStep(UCAT_LEARN_TOUR, 2)).toEqual(
      expect.objectContaining({
        selector: "[data-tour='learning-modules']",
        hideBack: true,
      }),
    );
  });

  it("continues Skill trainer selection onto its detail page", () => {
    expect(getTourStep(UCAT_SKILL_TRAINER_TOUR, 1)).toEqual(
      expect.objectContaining({
        interactionSelector: "[data-tour='skill-trainer-option'] a",
        showControls: false,
      }),
    );
    expect(getTourStep(UCAT_SKILL_TRAINER_TOUR, 2)).toEqual(
      expect.objectContaining({
        selector: "[data-tour='skill-trainer-tutorial']",
        hideBack: true,
        scrollMode: "page-start",
      }),
    );
    expect(getTourStep(UCAT_SKILL_TRAINER_TOUR, 3)).toEqual(
      expect.objectContaining({
        selector: "[data-tour='skill-trainer-start']",
      }),
    );
  });

  it("keeps expanded Study guidance separate from the hidden-guidance fallback", () => {
    expect(getTourStep(UCAT_DASHBOARD_TOUR, 8)).toEqual(
      expect.objectContaining({
        selector: "[data-tour='study-guidance-orb']",
        interactionSelector: "[data-tour='study-guidance-orb']",
        showControls: false,
      }),
    );
    expect(getTourStep(UCAT_DASHBOARD_TOUR, 9)).toEqual(
      expect.objectContaining({
        selector: "[data-dashboard-guidance-panel]",
        backInteractionAdvanceDelayMs: 300,
        showControls: true,
        completeOnInteraction: true,
      }),
    );
    expect(getTourStep(UCAT_DASHBOARD_TOUR, 10)).toEqual(
      expect.objectContaining({
        selector: "[data-dashboard-guidance-fallback]",
        showControls: true,
      }),
    );
  });

  it.each([
    [UCAT_PROGRESS_TOUR, 4],
    [UCAT_SETS_TOUR, 2],
    [UCAT_SETS_TOUR, 3],
    [UCAT_MOCKS_TOUR, 2],
  ])("treats %s step %i as the first step on its page", (tourId, stepIndex) => {
    expect(getTourStep(tourId, stepIndex)).toEqual(
      expect.objectContaining({ hideBack: true }),
    );
  });

  it.each([
    [UCAT_SETS_TOUR, 3],
    [UCAT_MOCKS_TOUR, 2],
  ])("scrolls %s structure step %i to page start", (tourId, stepIndex) => {
    expect(getTourStep(tourId, stepIndex)).toEqual(
      expect.objectContaining({ scrollMode: "page-start" }),
    );
  });
});
