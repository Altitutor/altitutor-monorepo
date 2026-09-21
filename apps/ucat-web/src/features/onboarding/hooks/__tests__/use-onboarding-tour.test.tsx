import { act, renderHook } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { useNextStep } from "nextstepjs";
import { useResetOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-progress";
import { useOnboardingTour } from "@/features/onboarding/hooks/use-onboarding-tour";

jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("nextstepjs", () => ({ useNextStep: jest.fn() }), { virtual: true });
jest.mock("@/features/onboarding/hooks/use-onboarding-progress", () => ({
  useResetOnboardingTour: jest.fn(),
}));

const mockedUseRouter = jest.mocked(useRouter);
const mockedUseNextStep = jest.mocked(useNextStep);
const mockedUseResetOnboardingTour = jest.mocked(useResetOnboardingTour);

describe("useOnboardingTour", () => {
  const push = jest.fn();
  const startNextStep = jest.fn();
  const resetTour = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    window.sessionStorage.clear();
    push.mockReset();
    startNextStep.mockReset();
    resetTour.mockReset();
    mockedUseRouter.mockReturnValue({
      push,
    } as unknown as ReturnType<typeof useRouter>);
    mockedUseNextStep.mockReturnValue({
      currentStep: 0,
      currentTour: null,
      setCurrentStep: jest.fn(),
      closeNextStep: jest.fn(),
      startNextStep,
      isNextStepVisible: false,
    });
    mockedUseResetOnboardingTour.mockReturnValue({
      mutateAsync: resetTour,
      isPending: false,
    } as unknown as ReturnType<typeof useResetOnboardingTour>);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("replays from Settings without resetting saved completion", () => {
    const anchor = document.createElement("div");
    anchor.dataset.tour = "dashboard-welcome-heading";
    document.body.appendChild(anchor);
    const { result } = renderHook(() => useOnboardingTour());

    act(() => {
      result.current.replayTour("ucat-dashboard-intro", "/dashboard");
      jest.advanceTimersByTime(520);
    });

    expect(resetTour).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/dashboard");
    expect(startNextStep).toHaveBeenCalledWith("ucat-dashboard-intro");
    expect(
      JSON.parse(
        window.sessionStorage.getItem("ucat-contextual-tutorial-replay")!,
      ),
    ).toEqual({
      tourId: "ucat-dashboard-intro",
      returnTo: "/settings/app",
    });
    anchor.remove();
  });
});
