import React from "react";
import { act, fireEvent, render } from "@testing-library/react";
import { useNextStep } from "nextstepjs";
import { QuestionEngineTutorialInteractions } from "@/features/question-engine/components/question-engine-tutorial-interactions";
import { getTourStep } from "@/features/onboarding/config/tour-steps";
import { useCompleteOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";

jest.mock("nextstepjs", () => ({ useNextStep: jest.fn() }), { virtual: true });
jest.mock("@/features/onboarding/config/tour-steps", () => ({
  UCAT_QUESTION_ENGINE_CONTROLS_TOUR: "ucat-question-engine-controls-intro",
  UCAT_QUESTION_ENGINE_TOUR: "ucat-question-engine-intro",
  getTourStep: jest.fn(),
}));
jest.mock("@/features/onboarding/hooks/use-onboarding-progress", () => ({
  useCompleteOnboardingTour: jest.fn(),
}));

const mockedUseNextStep = jest.mocked(useNextStep);
const mockedGetTourStep = jest.mocked(getTourStep);
const mockedUseCompleteOnboardingTour = jest.mocked(useCompleteOnboardingTour);

describe("QuestionEngineTutorialInteractions", () => {
  const setCurrentStep = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    setCurrentStep.mockReset();
    document.body.innerHTML = `
      <button data-tour="question-engine-calculator">Calculator</button>
    `;
    mockedUseNextStep.mockReturnValue({
      currentTour: "ucat-question-engine-intro",
      currentStep: 2,
      setCurrentStep,
      closeNextStep: jest.fn(),
      startNextStep: jest.fn(),
      isNextStepVisible: true,
    });
    mockedGetTourStep.mockImplementation((_tour, step) =>
      step === 3
        ? {
            icon: null,
            title: "Try the calculator",
            content: null,
            selector: "[data-tour='question-engine-calculator-panel']",
          }
        : null,
    );
    mockedUseCompleteOnboardingTour.mockReturnValue({
      mutateAsync: jest.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useCompleteOnboardingTour>);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("waits for a lagged calculator panel before moving its spotlight", async () => {
    render(<QuestionEngineTutorialInteractions />);

    fireEvent.click(
      document.querySelector("[data-tour='question-engine-calculator']")!,
    );
    act(() => jest.advanceTimersByTime(500));
    expect(setCurrentStep).not.toHaveBeenCalled();

    const panel = document.createElement("div");
    panel.dataset.tour = "question-engine-calculator-panel";
    document.body.append(panel);
    await act(async () => undefined);
    act(() => jest.advanceTimersByTime(160));

    expect(setCurrentStep).toHaveBeenCalledWith(3);
  });

  it("lets toolbar controls run while explaining them in one playground step", () => {
    document.body.innerHTML = `
      <aside data-tour="question-engine-settings">
        <button data-tour="question-engine-toolbar-lag">Lag mode</button>
        <button data-tour="question-engine-toolbar-report">Report bug</button>
      </aside>
    `;
    mockedUseNextStep.mockReturnValue({
      currentTour: "ucat-question-engine-intro",
      currentStep: 1,
      setCurrentStep,
      closeNextStep: jest.fn(),
      startNextStep: jest.fn(),
      isNextStepVisible: true,
    });
    const lagAction = jest.fn();
    const reportAction = jest.fn();
    const feedback = jest.fn();
    document
      .querySelector("[data-tour='question-engine-toolbar-lag']")
      ?.addEventListener("click", lagAction);
    document
      .querySelector("[data-tour='question-engine-toolbar-report']")
      ?.addEventListener("click", reportAction);
    window.addEventListener("ucat:tutorial-feedback", feedback);

    const view = render(<QuestionEngineTutorialInteractions />);
    fireEvent.click(
      document.querySelector("[data-tour='question-engine-toolbar-lag']")!,
    );
    expect(lagAction).toHaveBeenCalledTimes(1);
    expect(feedback).toHaveBeenCalledTimes(1);

    fireEvent.click(
      document.querySelector("[data-tour='question-engine-toolbar-report']")!,
    );
    expect(reportAction).not.toHaveBeenCalled();
    expect(feedback).toHaveBeenCalledTimes(2);

    view.unmount();
    window.removeEventListener("ucat:tutorial-feedback", feedback);
  });

  it("remeasures when the toolbar target is replaced in either layout direction", async () => {
    document.body.innerHTML = `
      <aside data-tour="question-engine-settings">Top toolbar</aside>
    `;
    mockedUseNextStep.mockReturnValue({
      currentTour: "ucat-question-engine-intro",
      currentStep: 1,
      setCurrentStep,
      closeNextStep: jest.fn(),
      startNextStep: jest.fn(),
      isNextStepVisible: true,
    });
    const repaint = jest.fn();
    window.addEventListener("resize", repaint);
    const view = render(<QuestionEngineTutorialInteractions />);
    act(() => jest.advanceTimersByTime(50));
    repaint.mockClear();

    const replacement = document.createElement("aside");
    replacement.dataset.tour = "question-engine-settings";
    replacement.textContent = "Right toolbar";
    document
      .querySelector("[data-tour='question-engine-settings']")
      ?.replaceWith(replacement);
    await act(async () => undefined);
    act(() => jest.advanceTimersByTime(50));

    expect(repaint).toHaveBeenCalled();
    repaint.mockClear();

    const restored = document.createElement("aside");
    restored.dataset.tour = "question-engine-settings";
    restored.textContent = "Top toolbar again";
    replacement.replaceWith(restored);
    await act(async () => undefined);
    act(() => jest.advanceTimersByTime(50));

    expect(repaint).toHaveBeenCalled();
    view.unmount();
    window.removeEventListener("resize", repaint);
  });

  it("blocks question-engine shortcuts while still allowing the tutorial to observe them", () => {
    document.body.innerHTML = `
      <button data-tour="question-engine-next">Next</button>
    `;
    mockedUseNextStep.mockReturnValue({
      currentTour: "ucat-question-engine-intro",
      currentStep: 11,
      setCurrentStep,
      closeNextStep: jest.fn(),
      startNextStep: jest.fn(),
      isNextStepVisible: true,
    });
    const engineShortcut = jest.fn();
    const nextAction = jest.fn();
    document.addEventListener("keydown", engineShortcut);
    document
      .querySelector("[data-tour='question-engine-next']")
      ?.addEventListener("click", nextAction);

    const view = render(<QuestionEngineTutorialInteractions />);
    fireEvent.keyDown(window, { altKey: true, code: "KeyN", key: "n" });
    fireEvent.keyDown(window, { code: "KeyA", key: "a" });

    expect(engineShortcut).not.toHaveBeenCalled();
    expect(nextAction).not.toHaveBeenCalled();
    expect(setCurrentStep).not.toHaveBeenCalled();
    view.unmount();
    document.removeEventListener("keydown", engineShortcut);
  });
});
