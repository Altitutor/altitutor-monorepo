import React, { type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import GuidedSamplerRoute from "../page";

jest.mock(
  "@/features/signup-onboarding/components/guided-sampler-page",
  () => ({ GuidedSamplerPage: () => <div data-testid="guided-sampler" /> }),
);

jest.mock(
  "@/features/exam-attempts/context/active-exam-attempt-context",
  () => ({
    ActiveExamAttemptProvider: ({ children }: { children: ReactNode }) => (
      <div data-testid="active-attempt-provider">{children}</div>
    ),
  }),
);

jest.mock("@/features/onboarding", () => ({
  OnboardingProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="onboarding-provider">{children}</div>
  ),
}));

jest.mock(
  "@/features/question-engine/context/ucat-lag-context",
  () => ({
    UcatLagProvider: ({ children }: { children: ReactNode }) => (
      <div data-testid="ucat-lag-provider">{children}</div>
    ),
  }),
);

jest.mock(
  "@/features/study-plan/context/study-plan-companion-context",
  () => ({
    StudyPlanCompanionProvider: ({ children }: { children: ReactNode }) => (
      <div data-testid="study-plan-companion-provider">{children}</div>
    ),
  }),
);

jest.mock("@/features/ucat-access/context/upsell-dialog-context", () => ({
  UpsellDialogProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="upsell-dialog-provider">{children}</div>
  ),
}));

describe("/signup/complete/sampler route", () => {
  it("provides the question-engine runtime outside the authenticated app shell", () => {
    render(<GuidedSamplerRoute />);

    const upsellDialogProvider = screen.getByTestId("upsell-dialog-provider");
    const activeAttemptProvider = screen.getByTestId(
      "active-attempt-provider",
    );
    const studyPlanProvider = screen.getByTestId(
      "study-plan-companion-provider",
    );
    const onboardingProvider = screen.getByTestId("onboarding-provider");
    const lagProvider = screen.getByTestId("ucat-lag-provider");
    const sampler = screen.getByTestId("guided-sampler");

    expect(upsellDialogProvider).toContainElement(activeAttemptProvider);
    expect(activeAttemptProvider).toContainElement(studyPlanProvider);
    expect(studyPlanProvider).toContainElement(onboardingProvider);
    expect(onboardingProvider).toContainElement(lagProvider);
    expect(lagProvider).toContainElement(sampler);
  });
});
