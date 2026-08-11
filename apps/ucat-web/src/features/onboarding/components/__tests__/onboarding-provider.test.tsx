import React from "react";
import { render } from "@testing-library/react";
import { OnboardingProvider } from "@/features/onboarding/components/onboarding-provider";

const captureNextStepProps = jest.fn();
(globalThis as typeof globalThis & { React: typeof React }).React = React;

jest.mock("nextstepjs", () => ({
  NextStepProvider: ({ children }: { children: React.ReactNode }) => children,
  NextStep: (props: { children: React.ReactNode }) => {
    captureNextStepProps(props);
    return props.children;
  },
}), { virtual: true });
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
  useCompleteOnboardingTour: () => ({ mutate: jest.fn() }),
}));

describe("OnboardingProvider", () => {
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
});
