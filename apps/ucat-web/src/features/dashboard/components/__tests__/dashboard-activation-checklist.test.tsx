import React from "react";
import { render, screen } from "@testing-library/react";
import { DashboardActivationChecklist } from "@/features/dashboard/components/dashboard-activation-checklist";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";
import { useQuestionEngineTutorialGate } from "@/features/onboarding/hooks/use-question-engine-tutorial-gate";
import { useProgressAttempts } from "@/features/progress/hooks/use-progress-attempts";
import { useStudyPlan } from "@/features/study-plan/hooks/use-study-plan";
import type { QuestionEngineTutorialKind } from "@/features/onboarding/lib/question-engine-tutorial-gate";

jest.mock("@/features/onboarding/hooks/use-onboarding-progress", () => ({
  useOnboardingProgress: jest.fn(),
}));
jest.mock(
  "@/features/onboarding/hooks/use-question-engine-tutorial-gate",
  () => ({
    useQuestionEngineTutorialGate: jest.fn(),
  }),
);
jest.mock("@/features/progress/hooks/use-progress-attempts", () => ({
  useProgressAttempts: jest.fn(),
}));
jest.mock("@/features/study-plan/hooks/use-study-plan", () => ({
  useStudyPlan: jest.fn(),
}));
jest.mock("@/features/subscription/components/referral-dialog", () => ({
  ReferralDialog: () => null,
}));

const mockedUseOnboardingProgress = jest.mocked(useOnboardingProgress);
const mockedUseQuestionEngineTutorialGate = jest.mocked(
  useQuestionEngineTutorialGate,
);
const mockedUseProgressAttempts = jest.mocked(useProgressAttempts);
const mockedUseStudyPlan = jest.mocked(useStudyPlan);

function mockChecklist({
  completed = ["ucat-guided-sampler-decided", "ucat-study-plan-decided"],
  tutorialKind = "full",
  attemptTotal = 0,
}: {
  completed?: string[];
  tutorialKind?: QuestionEngineTutorialKind;
  attemptTotal?: number;
} = {}) {
  mockedUseOnboardingProgress.mockReturnValue({
    isLoading: false,
    isCompleted: (tourId: string) => completed.includes(tourId),
  } as ReturnType<typeof useOnboardingProgress>);
  mockedUseQuestionEngineTutorialGate.mockReturnValue({
    isLoading: false,
    tutorialKind,
  } as ReturnType<typeof useQuestionEngineTutorialGate>);
  mockedUseStudyPlan.mockReturnValue({
    isLoading: false,
    data: { profile: { testYear: 2026, targetScore: 2100 } },
  } as ReturnType<typeof useStudyPlan>);
  mockedUseProgressAttempts.mockReturnValue({
    isLoading: false,
    data: { total: attemptTotal },
  } as ReturnType<typeof useProgressAttempts>);
}

describe("DashboardActivationChecklist", () => {
  it("places the question-interface tutorial before the first real question", () => {
    mockChecklist();
    render(<DashboardActivationChecklist />);

    const tutorial = screen.getByText("Learn the question interface");
    const firstQuestion = screen.getByText("Do your first UCAT question");
    expect(
      tutorial.compareDocumentPosition(firstQuestion) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("sends new and familiar students through the full tutorial back to the dashboard", () => {
    mockChecklist({ tutorialKind: "full" });
    render(<DashboardActivationChecklist />);

    expect(
      screen.getByRole("link", { name: /Learn the question interface/ }),
    ).toHaveAttribute("href", "/exam/tutorial?returnTo=%2Fdashboard");
  });

  it("sends experienced students through the Altitutor-controls tutorial", () => {
    mockChecklist({ tutorialKind: "controls" });
    render(<DashboardActivationChecklist />);

    expect(
      screen.getByRole("link", { name: /Learn the question interface/ }),
    ).toHaveAttribute("href", "/exam/controls-tutorial?returnTo=%2Fdashboard");
  });

  it("ticks the tutorial after the Altitutor-controls walkthrough", () => {
    mockChecklist({
      completed: [
        "ucat-guided-sampler-decided",
        "ucat-study-plan-decided",
        "ucat-question-engine-controls-intro",
      ],
    });
    render(<DashboardActivationChecklist />);

    expect(
      screen.queryByRole("link", { name: /Learn the question interface/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Learn the question interface"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Do your first UCAT question/ }),
    ).toBeInTheDocument();
  });

  it("hides the card once every setup item is complete", () => {
    mockChecklist({
      completed: [
        "ucat-guided-sampler-decided",
        "ucat-study-plan-decided",
        "ucat-question-engine-intro",
        "ucat-referral-shared",
      ],
      attemptTotal: 1,
    });
    render(<DashboardActivationChecklist />);

    expect(screen.queryByText(/Finish setting up/)).not.toBeInTheDocument();
  });
});
