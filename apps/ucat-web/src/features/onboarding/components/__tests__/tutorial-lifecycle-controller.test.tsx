import React from "react";
import { render } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { useNextStep } from "nextstepjs";
import { TutorialLifecycleController } from "@/features/onboarding/components/tutorial-lifecycle-controller";
import { getTourStep } from "@/features/onboarding/config/tour-steps";
import { useCompleteOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";

jest.mock("next/navigation", () => ({ usePathname: jest.fn() }));
jest.mock("nextstepjs", () => ({ useNextStep: jest.fn() }), { virtual: true });
jest.mock("@/features/onboarding/config/tour-steps", () => ({
  getTourStep: jest.fn(),
}));
jest.mock("@/features/onboarding/hooks/use-onboarding-progress", () => ({
  useCompleteOnboardingTour: jest.fn(),
}));

const mockedUsePathname = jest.mocked(usePathname);
const mockedUseNextStep = jest.mocked(useNextStep);
const mockedGetTourStep = jest.mocked(getTourStep);
const mockedUseCompleteOnboardingTour = jest.mocked(useCompleteOnboardingTour);

describe("TutorialLifecycleController", () => {
  const closeNextStep = jest.fn();
  const mutate = jest.fn();

  beforeEach(() => {
    window.sessionStorage.clear();
    closeNextStep.mockReset();
    mutate.mockReset();
    mockedUsePathname.mockReturnValue("/dashboard");
    mockedGetTourStep.mockReturnValue({
      icon: null,
      title: "Next",
      content: null,
    });
    mockedUseNextStep.mockReturnValue({
      currentStep: 1,
      currentTour: "ucat-dashboard-intro",
      setCurrentStep: jest.fn(),
      closeNextStep,
      startNextStep: jest.fn(),
      isNextStepVisible: true,
    });
    mockedUseCompleteOnboardingTour.mockReturnValue({
      mutate,
    } as unknown as ReturnType<typeof useCompleteOnboardingTour>);
  });

  afterEach(() => {
    document.documentElement.removeAttribute("style");
    document.body.removeAttribute("style");
  });

  it("locks user scrolling outside the tutorial card and restores styles", () => {
    document.body.style.overflow = "auto";
    const view = render(<TutorialLifecycleController />);

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    const wheel = new WheelEvent("wheel", { cancelable: true });
    window.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);

    const card = document.createElement("div");
    card.dataset.name = "nextstep-card";
    document.body.appendChild(card);
    const cardWheel = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
    });
    card.dispatchEvent(cardWheel);
    expect(cardWheel.defaultPrevented).toBe(false);

    view.unmount();
    expect(document.body.style.overflow).toBe("auto");
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("closes on navigation and stores the next step for the page left", () => {
    const view = render(<TutorialLifecycleController />);
    mockedUsePathname.mockReturnValue("/study-plan");
    view.rerender(<TutorialLifecycleController />);

    expect(closeNextStep).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(
        window.sessionStorage.getItem("ucat-contextual-tutorial-resume")!,
      ),
    ).toEqual({
      tourId: "ucat-dashboard-intro",
      stepIndex: 2,
      pathname: "/dashboard",
    });
  });

  it("completes the tour when navigation leaves its last step", () => {
    mockedGetTourStep.mockReturnValue(null);
    const view = render(<TutorialLifecycleController />);
    mockedUsePathname.mockReturnValue("/study-plan");
    view.rerender(<TutorialLifecycleController />);

    expect(mutate).toHaveBeenCalledWith("ucat-dashboard-intro");
    expect(closeNextStep).toHaveBeenCalledTimes(1);
  });

  it("preserves an exact cross-route handoff instead of incrementing twice", () => {
    window.sessionStorage.setItem(
      "ucat-contextual-tutorial-resume",
      JSON.stringify({
        tourId: "ucat-dashboard-intro",
        stepIndex: 2,
        pathname: "/study-plan",
      }),
    );
    const view = render(<TutorialLifecycleController />);
    mockedUsePathname.mockReturnValue("/study-plan");
    view.rerender(<TutorialLifecycleController />);

    expect(closeNextStep).toHaveBeenCalledTimes(1);
    expect(
      JSON.parse(
        window.sessionStorage.getItem("ucat-contextual-tutorial-resume")!,
      ),
    ).toEqual({
      tourId: "ucat-dashboard-intro",
      stepIndex: 2,
      pathname: "/study-plan",
    });
  });
});
