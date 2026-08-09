import React from "react";
import { act, render } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { useNextStep } from "nextstepjs";
import { useAuth } from "@/features/auth";
import { OnboardingAutoStart } from "@/features/onboarding/components/onboarding-auto-start";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";

jest.mock("next/navigation", () => ({ usePathname: jest.fn() }));
jest.mock("nextstepjs", () => ({ useNextStep: jest.fn() }), { virtual: true });
jest.mock("@/features/auth", () => ({ useAuth: jest.fn() }));
jest.mock("@/features/onboarding/hooks/use-onboarding-progress", () => ({
  useOnboardingProgress: jest.fn(),
}));
jest.mock("@/features/onboarding/config/tour-catalog", () => ({
  getAutoStartTourForPathname: (pathname: string) =>
    pathname === "/dashboard" ? "ucat-dashboard-intro" : null,
}));
jest.mock("@/features/onboarding/config/tour-steps", () => ({
  getFirstSelectorForTour: () => "#tutorial-target",
}));
jest.mock("@/features/onboarding/lib/suppress-next-auto-tour", () => ({
  consumeOnboardingAutoStartSuppression: () => false,
}));

const mockedUsePathname = jest.mocked(usePathname);
const mockedUseNextStep = jest.mocked(useNextStep);
const mockedUseAuth = jest.mocked(useAuth);
const mockedUseOnboardingProgress = jest.mocked(useOnboardingProgress);

describe("OnboardingAutoStart", () => {
  const startNextStep = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    startNextStep.mockReset();
    document.body.innerHTML = '<div id="tutorial-target"></div>';
    mockedUsePathname.mockReturnValue("/dashboard");
    mockedUseNextStep.mockReturnValue({
      currentStep: 0,
      currentTour: null,
      setCurrentStep: jest.fn(),
      closeNextStep: jest.fn(),
      startNextStep,
      isNextStepVisible: false,
    });
    mockedUseAuth.mockReturnValue({
      user: { id: "student-1" },
      isLoading: false,
    } as ReturnType<typeof useAuth>);
    mockedUseOnboardingProgress.mockReturnValue({
      progress: {},
      isLoading: false,
      isFetching: false,
      isCompleted: () => false,
      refetch: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts an incomplete contextual tutorial once its first target is ready", () => {
    render(<OnboardingAutoStart />);

    act(() => jest.advanceTimersByTime(600));

    expect(startNextStep).toHaveBeenCalledTimes(1);
    expect(startNextStep).toHaveBeenCalledWith("ucat-dashboard-intro");
  });

  it("does not start a tutorial already completed at its current version", () => {
    mockedUseOnboardingProgress.mockReturnValue({
      progress: {},
      isLoading: false,
      isFetching: false,
      isCompleted: () => true,
      refetch: jest.fn(),
    });

    render(<OnboardingAutoStart />);
    act(() => jest.advanceTimersByTime(1_000));

    expect(startNextStep).not.toHaveBeenCalled();
  });

  it("allows a postponed tutorial to start on a later page visit", () => {
    const view = render(<OnboardingAutoStart />);
    act(() => jest.advanceTimersByTime(600));
    expect(startNextStep).toHaveBeenCalledTimes(1);

    mockedUsePathname.mockReturnValue("/settings/app");
    view.rerender(<OnboardingAutoStart />);
    mockedUsePathname.mockReturnValue("/dashboard");
    view.rerender(<OnboardingAutoStart />);
    act(() => jest.advanceTimersByTime(600));

    expect(startNextStep).toHaveBeenCalledTimes(2);
  });
});
