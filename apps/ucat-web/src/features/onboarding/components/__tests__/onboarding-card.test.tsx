import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useNextStep } from "nextstepjs";
import { OnboardingCard } from "@/features/onboarding/components/onboarding-card";
import type { ContextualTourStep } from "@/features/onboarding/config/tour-steps";

jest.mock("nextstepjs", () => ({ useNextStep: jest.fn() }), { virtual: true });

const mockedUseNextStep = jest.mocked(useNextStep);

describe("contextual tutorial coach", () => {
  const closeNextStep = jest.fn();
  const skipTour = jest.fn();

  beforeEach(() => {
    closeNextStep.mockReset();
    skipTour.mockReset();
    jest.spyOn(window, "confirm").mockReturnValue(true);
    mockedUseNextStep.mockReturnValue({
      currentStep: 0,
      currentTour: "ucat-dashboard-intro",
      setCurrentStep: jest.fn(),
      closeNextStep,
      startNextStep: jest.fn(),
      isNextStepVisible: true,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("presents accessible progress and separates postponing from skipping", () => {
    render(
      <OnboardingCard
        step={{
          icon: null,
          title: "Your predicted score",
          content: <p>Your estimate will appear here.</p>,
          showControls: true,
          showSkip: true,
        }}
        currentStep={0}
        totalSteps={3}
        nextStep={jest.fn()}
        prevStep={jest.fn()}
        skipTour={skipTour}
        arrow={<span />}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Your predicted score" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(closeNextStep).toHaveBeenCalledTimes(1);
    expect(skipTour).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Skip tutorial" }));
    expect(window.confirm).toHaveBeenCalledWith(
      "Are you sure you want to skip this tutorial? You can replay it from Settings.",
    );
    expect(skipTour).toHaveBeenCalledTimes(1);
  });

  it("keeps the tutorial open when permanent skip is cancelled", () => {
    jest.mocked(window.confirm).mockReturnValue(false);
    render(
      <OnboardingCard
        step={{
          icon: null,
          title: "Welcome",
          content: <p>Tour content</p>,
          showControls: true,
          showSkip: true,
        }}
        currentStep={0}
        totalSteps={2}
        nextStep={jest.fn()}
        prevStep={jest.fn()}
        skipTour={skipTour}
        arrow={<span />}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip tutorial" }));

    expect(skipTour).not.toHaveBeenCalled();
  });

  it("keeps the orb clickable on mobile and still offers permanent skip", () => {
    render(
      <OnboardingCard
        step={
          {
            icon: null,
            title: "Open your Study guidance",
            content: <p>Open the highlighted orb.</p>,
            showControls: false,
            showSkip: true,
            interactionSelector: "[data-tour='study-guidance-orb']",
          } as ContextualTourStep
        }
        currentStep={1}
        totalSteps={2}
        nextStep={jest.fn()}
        prevStep={jest.fn()}
        skipTour={skipTour}
        arrow={<span />}
      />,
    );

    const dialog = screen.getByRole("dialog", {
      name: "Open your Study guidance",
    });
    expect(dialog.parentElement).toHaveClass("top-0");
    expect(screen.getByRole("button", { name: "Skip tutorial" })).toBeVisible();
  });
});
