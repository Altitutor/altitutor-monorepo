import React from "react";
import { render } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { OnboardingProvider } from "@/features/onboarding/components/onboarding-provider";

const captureNextStepProps = jest.fn();
const mutate = jest.fn();
const push = jest.fn();
(globalThis as typeof globalThis & { React: typeof React }).React = React;

jest.mock("nextstepjs", () => ({
  NextStepProvider: ({ children }: { children: React.ReactNode }) => children,
  NextStep: (props: { children: React.ReactNode }) => {
    captureNextStepProps(props);
    return props.children;
  },
}), { virtual: true });
jest.mock("next/navigation", () => ({ useRouter: jest.fn() }));
jest.mock("next-themes", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
jest.mock("@/features/onboarding/components/onboarding-scroll-repaint", () => ({
  OnboardingScrollRepaint: () => null,
}));
jest.mock("@/features/onboarding/components/tutorial-interaction-controller", () => ({
  TutorialInteractionController: () => null,
}));
jest.mock("@/features/onboarding/components/tutorial-lifecycle-controller", () => ({
  TutorialLifecycleController: () => null,
}));
jest.mock("@/features/onboarding/hooks/use-onboarding-progress", () => ({
  useCompleteOnboardingTour: () => ({ mutate }),
}));

describe("OnboardingProvider", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    mutate.mockReset();
    push.mockReset();
    jest.mocked(useRouter).mockReturnValue({
      push,
    } as unknown as ReturnType<typeof useRouter>);
  });

  it("uses a neutral black dimmer in light mode", () => {
    render(
      <OnboardingProvider>
        <div>App</div>
      </OnboardingProvider>,
    );

    expect(captureNextStepProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ shadowRgb: "0,0,0" }),
    );
  });

  it("returns a completed Settings replay without writing completion again", () => {
    window.sessionStorage.setItem(
      "ucat-contextual-tutorial-replay",
      JSON.stringify({
        tourId: "ucat-dashboard-intro",
        returnTo: "/settings/app",
      }),
    );
    render(
      <OnboardingProvider>
        <div>App</div>
      </OnboardingProvider>,
    );

    const nextStepProps = captureNextStepProps.mock.lastCall?.[0] as {
      onComplete: (tour: string) => void;
    };
    nextStepProps.onComplete("ucat-dashboard-intro");

    expect(mutate).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/settings/app");
    expect(
      window.sessionStorage.getItem("ucat-contextual-tutorial-replay"),
    ).toBeNull();
  });
});
