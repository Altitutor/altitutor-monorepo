import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { useNextStep } from "nextstepjs";
import { OnboardingCard } from "@/features/onboarding/components/onboarding-card";
import type { ContextualTourStep } from "@/features/onboarding/config/tour-steps";

jest.mock("nextstepjs", () => ({ useNextStep: jest.fn() }), { virtual: true });

const mockedUseNextStep = jest.mocked(useNextStep);

describe("contextual tutorial coach", () => {
  const closeNextStep = jest.fn();
  const setCurrentStep = jest.fn();
  const skipTour = jest.fn();

  beforeEach(() => {
    closeNextStep.mockReset();
    setCurrentStep.mockReset();
    skipTour.mockReset();
    jest.spyOn(window, "confirm").mockReturnValue(true);
    mockedUseNextStep.mockReturnValue({
      currentStep: 0,
      currentTour: "ucat-dashboard-intro",
      setCurrentStep,
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
    fireEvent.click(
      screen
        .getByRole("alertdialog")
        .querySelector("[data-dialog-primary-action]")!,
    );
    expect(skipTour).toHaveBeenCalledTimes(1);
  });

  it("keeps the tutorial open when permanent skip is cancelled", () => {
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

    expect(
      screen.getByRole("alertdialog", { name: "Skip this tutorial?" }),
    ).toBeInTheDocument();
    expect(skipTour).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    expect(skipTour).not.toHaveBeenCalled();
  });

  it("uses an app-native confirmation before permanently skipping", () => {
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
    expect(window.confirm).not.toHaveBeenCalled();
    fireEvent.click(
      screen
        .getByRole("alertdialog")
        .querySelector("[data-dialog-primary-action]")!,
    );
    expect(skipTour).toHaveBeenCalledTimes(1);
  });

  it("uses the native skip flow for the abbreviated engine tutorial", () => {
    mockedUseNextStep.mockReturnValue({
      currentStep: 0,
      currentTour: "ucat-question-engine-controls-intro",
      setCurrentStep,
      closeNextStep,
      startNextStep: jest.fn(),
      isNextStepVisible: true,
    });
    render(
      <OnboardingCard
        step={{
          icon: null,
          title: "The Altitutor menu",
          content: <p>Altitutor controls.</p>,
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

    expect(window.confirm).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Skip and continue" }),
    ).toBeInTheDocument();
  });

  it("shows contextual feedback from controls without changing tutorial step", () => {
    render(
      <OnboardingCard
        step={{
          icon: null,
          title: "Explore the Altitutor controls",
          content: <p>Try each control.</p>,
          showControls: true,
          showSkip: true,
        }}
        currentStep={1}
        totalSteps={14}
        nextStep={jest.fn()}
        prevStep={jest.fn()}
        skipTour={skipTour}
        arrow={<span />}
      />,
    );

    fireEvent(
      window,
      new CustomEvent("ucat:tutorial-feedback", {
        detail: {
          title: "Lag mode",
          description: "Adds a short delay to question controls.",
        },
      }),
    );

    expect(screen.getByRole("status")).toHaveTextContent("Lag mode");
    expect(screen.getByRole("status")).toHaveTextContent("Adds a short delay");
    expect(setCurrentStep).not.toHaveBeenCalled();
  });

  it("dims and disables the tutorial while skip confirmation is open", () => {
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

    expect(
      screen.getByRole("dialog", { name: "Welcome", hidden: true }),
    ).toHaveClass("pointer-events-none");
    expect(
      document.querySelector("[data-tutorial-confirmation-overlay]"),
    ).toHaveClass("z-[1390]", "bg-black/70");
  });

  it("finishes when the last displayed step is dismissed", () => {
    const nextStep = jest.fn();
    mockedUseNextStep.mockReturnValue({
      currentStep: 1,
      currentTour: "test-tour",
      setCurrentStep: jest.fn(),
      closeNextStep,
      startNextStep: jest.fn(),
      isNextStepVisible: true,
    });
    render(
      <OnboardingCard
        step={{
          icon: null,
          title: "Last step",
          content: <p>Done.</p>,
          showControls: true,
          showSkip: true,
        }}
        currentStep={1}
        totalSteps={2}
        nextStep={nextStep}
        prevStep={jest.fn()}
        skipTour={skipTour}
        arrow={<span />}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Finish tutorial" }));
    expect(nextStep).toHaveBeenCalledTimes(1);
    expect(closeNextStep).not.toHaveBeenCalled();
  });

  it("hides Back on the first tutorial step rendered on a new page", () => {
    render(
      <OnboardingCard
        step={
          {
            icon: null,
            title: "Review the set structure",
            content: <p>Structure.</p>,
            showControls: true,
            showSkip: true,
            hideBack: true,
          } as ContextualTourStep
        }
        currentStep={3}
        totalSteps={5}
        nextStep={jest.fn()}
        prevStep={jest.fn()}
        skipTour={skipTour}
        arrow={<span />}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Back" }),
    ).not.toBeInTheDocument();
  });

  it("goes back to the previous rendered dashboard card", () => {
    const predictedScore = document.createElement("div");
    predictedScore.id = "tour-dashboard-predicted-score";
    document.body.appendChild(predictedScore);
    const week = document.createElement("div");
    week.dataset.tour = "dashboard-week-card";
    document.body.appendChild(week);

    mockedUseNextStep.mockReturnValue({
      currentStep: 4,
      currentTour: "ucat-dashboard-intro",
      setCurrentStep,
      closeNextStep,
      startNextStep: jest.fn(),
      isNextStepVisible: true,
    });
    const prevStep = jest.fn();
    render(
      <OnboardingCard
        step={
          {
            icon: null,
            title: "This week",
            content: <p>Week.</p>,
            selector: "[data-tour='dashboard-week-card']",
            showControls: true,
            showSkip: true,
            optional: true,
          } as ContextualTourStep
        }
        currentStep={4}
        totalSteps={11}
        nextStep={jest.fn()}
        prevStep={prevStep}
        skipTour={skipTour}
        arrow={<span />}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(setCurrentStep).toHaveBeenCalledWith(2);
    expect(prevStep).not.toHaveBeenCalled();
  });

  it("advances directly to the next rendered dashboard card", () => {
    const predictedScore = document.createElement("div");
    predictedScore.id = "tour-dashboard-predicted-score";
    document.body.appendChild(predictedScore);
    const week = document.createElement("div");
    week.dataset.tour = "dashboard-week-card";
    document.body.appendChild(week);

    mockedUseNextStep.mockReturnValue({
      currentStep: 2,
      currentTour: "ucat-dashboard-intro",
      setCurrentStep,
      closeNextStep,
      startNextStep: jest.fn(),
      isNextStepVisible: true,
    });
    const nextStep = jest.fn();
    render(
      <OnboardingCard
        step={
          {
            icon: null,
            title: "Your predicted score",
            content: <p>Score.</p>,
            selector: "#tour-dashboard-predicted-score",
            showControls: true,
            showSkip: true,
          } as ContextualTourStep
        }
        currentStep={2}
        totalSteps={11}
        nextStep={nextStep}
        prevStep={jest.fn()}
        skipTour={skipTour}
        arrow={<span />}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(setCurrentStep).toHaveBeenCalledWith(4);
    expect(nextStep).not.toHaveBeenCalled();
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
    expect(
      screen.getByText("Use the highlighted control to continue"),
    ).toBeVisible();
  });

  it("lets the last Study guidance step finish without forcing the next action", () => {
    const panel = document.createElement("div");
    panel.setAttribute("data-dashboard-guidance-panel", "");
    document.body.appendChild(panel);

    mockedUseNextStep.mockReturnValue({
      currentStep: 9,
      currentTour: "ucat-dashboard-intro",
      setCurrentStep,
      closeNextStep,
      startNextStep: jest.fn(),
      isNextStepVisible: true,
    });
    render(
      <OnboardingCard
        step={
          {
            icon: null,
            title: "Start when you are ready",
            content: (
              <p>
                Select it when you are ready, or finish this tutorial and come
                back another time.
              </p>
            ),
            selector: "[data-dashboard-guidance-panel]",
            interactionSelector: "[data-dashboard-guidance-action]",
            showControls: true,
            showSkip: true,
            optional: true,
            completeOnInteraction: true,
          } as ContextualTourStep
        }
        currentStep={9}
        totalSteps={11}
        nextStep={jest.fn()}
        prevStep={jest.fn()}
        skipTour={skipTour}
        arrow={<span />}
      />,
    );

    expect(screen.getByRole("button", { name: "Finish" })).toBeVisible();
    expect(
      screen.queryByText("Use the highlighted control to continue"),
    ).not.toBeInTheDocument();
    panel.remove();
  });
});
