import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useNextStep } from "nextstepjs";
import { TutorialInteractionController } from "@/features/onboarding/components/tutorial-interaction-controller";
import { getTourStep } from "@/features/onboarding/config/tour-steps";
import { useCompleteOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";
import { handoffTutorialToPath } from "@/features/onboarding/lib/tutorial-resume";

jest.mock("nextstepjs", () => ({ useNextStep: jest.fn() }), { virtual: true });
jest.mock("@/features/onboarding/config/tour-steps", () => ({
  getTourStep: jest.fn(),
}));
jest.mock("@/features/onboarding/hooks/use-onboarding-progress", () => ({
  useCompleteOnboardingTour: jest.fn(),
}));
jest.mock("@/features/onboarding/lib/tutorial-resume", () => ({
  clearTutorialResume: jest.fn(),
  handoffTutorialToPath: jest.fn(),
}));

const mockedUseNextStep = jest.mocked(useNextStep);
const mockedGetTourStep = jest.mocked(getTourStep);
const mockedUseCompleteOnboardingTour = jest.mocked(useCompleteOnboardingTour);
const mockedHandoffTutorialToPath = jest.mocked(handoffTutorialToPath);

describe("TutorialInteractionController", () => {
  const setCurrentStep = jest.fn();
  const closeNextStep = jest.fn();
  const mutateAsync = jest.fn().mockResolvedValue("ucat-learn-intro");

  beforeEach(() => {
    setCurrentStep.mockReset();
    closeNextStep.mockReset();
    mutateAsync.mockClear();
    mockedHandoffTutorialToPath.mockReset();
    document.body.innerHTML = `
      <button id="allowed">Open module</button>
      <button id="unrelated">Unrelated</button>
    `;
    mockedUseNextStep.mockReturnValue({
      currentStep: 0,
      currentTour: "ucat-learn-intro",
      setCurrentStep,
      closeNextStep,
      startNextStep: jest.fn(),
      isNextStepVisible: true,
    });
    mockedUseCompleteOnboardingTour.mockReturnValue({
      mutateAsync,
    } as unknown as ReturnType<typeof useCompleteOnboardingTour>);
  });

  it("advances only when the required real control is activated", () => {
    mockedGetTourStep.mockImplementation((_tour, step) =>
      step === 0
        ? {
            icon: null,
            title: "Choose",
            content: null,
            interactionSelector: "#allowed",
          }
        : {
            icon: null,
            title: "Next",
            content: null,
          },
    );

    render(<TutorialInteractionController />);
    fireEvent.click(document.querySelector("#unrelated")!);
    expect(setCurrentStep).not.toHaveBeenCalled();

    fireEvent.click(document.querySelector("#allowed")!);
    expect(setCurrentStep).toHaveBeenCalledWith(1);
  });

  it("persists completion before replaying a final navigation click", async () => {
    mockedGetTourStep.mockImplementation((_tour, step) =>
      step === 0
        ? {
            icon: null,
            title: "Choose",
            content: null,
            interactionSelector: "#allowed",
          }
        : null,
    );
    const realAction = jest.fn();
    document.querySelector("#allowed")?.addEventListener("click", realAction);

    render(<TutorialInteractionController />);
    fireEvent.click(document.querySelector("#allowed")!);

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith("ucat-learn-intro"),
    );
    await waitFor(() => expect(closeNextStep).toHaveBeenCalled());
    expect(realAction).toHaveBeenCalledTimes(1);
  });

  it("hands an outbound interaction to the exact next step", () => {
    document.body.innerHTML =
      '<a id="allowed" href="/sets/sections/1">Open</a>';
    document
      .querySelector("#allowed")
      ?.addEventListener("click", (event) => event.preventDefault());
    mockedGetTourStep.mockImplementation((_tour, step) =>
      step <= 1
        ? {
            icon: null,
            title: step === 0 ? "Choose" : "Sets",
            content: null,
            interactionSelector: step === 0 ? "#allowed" : undefined,
          }
        : null,
    );

    render(<TutorialInteractionController />);
    fireEvent.click(document.querySelector("#allowed")!);

    expect(mockedHandoffTutorialToPath).toHaveBeenCalledWith({
      tourId: "ucat-learn-intro",
      stepIndex: 1,
      pathname: "/sets/sections/1",
    });
    expect(closeNextStep).toHaveBeenCalledTimes(1);
    expect(setCurrentStep).not.toHaveBeenCalled();
  });

  it("completes a variant-specific final interaction before later fallbacks", async () => {
    mockedGetTourStep.mockImplementation((_tour, step) =>
      step === 0
        ? {
            icon: null,
            title: "Start guidance",
            content: null,
            interactionSelector: "#allowed",
            completeOnInteraction: true,
          }
        : {
            icon: null,
            title: "Fallback",
            content: null,
          },
    );

    render(<TutorialInteractionController />);
    fireEvent.click(document.querySelector("#allowed")!);

    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith("ucat-learn-intro"),
    );
    expect(setCurrentStep).not.toHaveBeenCalled();
    expect(closeNextStep).toHaveBeenCalledTimes(1);
  });

  it("returns to the previous step when a highlighted surface collapses", () => {
    document.body.innerHTML =
      '<button id="collapse">Collapse guidance</button>';
    mockedUseNextStep.mockReturnValue({
      currentStep: 2,
      currentTour: "ucat-dashboard-intro",
      setCurrentStep,
      closeNextStep,
      startNextStep: jest.fn(),
      isNextStepVisible: true,
    });
    mockedGetTourStep.mockReturnValue({
      icon: null,
      title: "Study guidance",
      content: null,
      backInteractionSelector: "#collapse",
    });

    render(<TutorialInteractionController />);
    fireEvent.click(document.querySelector("#collapse")!);

    expect(setCurrentStep).toHaveBeenCalledWith(1);
  });

  it("omits an optional step whose target is not rendered", () => {
    jest.useFakeTimers();
    mockedGetTourStep.mockImplementation((_tour, step) => {
      if (step === 0) {
        return {
          icon: null,
          title: "Optional card",
          content: null,
          selector: "#missing-card",
          optional: true,
        };
      }
      if (step === 1) {
        return {
          icon: null,
          title: "Visible card",
          content: null,
          selector: "#allowed",
        };
      }
      return null;
    });

    render(<TutorialInteractionController />);
    act(() => jest.advanceTimersByTime(120));

    expect(setCurrentStep).toHaveBeenCalledWith(1);
    jest.useRealTimers();
  });
});
