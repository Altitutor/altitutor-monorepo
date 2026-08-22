import { renderHook } from "@testing-library/react";
import { useUcatProfile } from "@/features/layout/hooks/use-ucat-profile";
import { useQuestionEngineTutorialGate } from "@/features/onboarding/hooks/use-question-engine-tutorial-gate";
import { useOnboardingProgress } from "@/features/onboarding/hooks/use-onboarding-progress";

jest.mock("@/features/layout/hooks/use-ucat-profile", () => ({
  useUcatProfile: jest.fn(),
}));
jest.mock("@/features/onboarding/hooks/use-onboarding-progress", () => ({
  useOnboardingProgress: jest.fn(),
}));

const mockedUseUcatProfile = jest.mocked(useUcatProfile);
const mockedUseOnboardingProgress = jest.mocked(useOnboardingProgress);

function mockGateState({
  familiarity,
  completed = [],
  progressError = false,
}: {
  familiarity: string | null;
  completed?: string[];
  progressError?: boolean;
}) {
  mockedUseUcatProfile.mockReturnValue({
    data: { ucatInitialFamiliarity: familiarity },
    isLoading: false,
  } as ReturnType<typeof useUcatProfile>);
  mockedUseOnboardingProgress.mockReturnValue({
    isLoading: false,
    isError: progressError,
    isCompleted: (tourId: string) => completed.includes(tourId),
  } as ReturnType<typeof useOnboardingProgress>);
}

describe("useQuestionEngineTutorialGate", () => {
  it.each([
    ["new", "full"],
    ["familiar", "controls"],
    ["experienced", "controls"],
    [null, "choose"],
  ])("selects %s familiarity guidance", (familiarity, tutorialKind) => {
    mockGateState({ familiarity });

    expect(renderHook(() => useQuestionEngineTutorialGate()).result.current)
      .toEqual(expect.objectContaining({
        isBlocked: true,
        tutorialKind,
      }));
  });

  it("lets an experienced student continue after either engine tutorial", () => {
    mockGateState({
      familiarity: "experienced",
      completed: ["ucat-question-engine-intro"],
    });

    expect(
      renderHook(() => useQuestionEngineTutorialGate()).result.current.isReady,
    ).toBe(true);
  });

  it("does not block question routes when tutorial progress is unavailable", () => {
    mockGateState({ familiarity: "new", progressError: true });

    expect(
      renderHook(() => useQuestionEngineTutorialGate()).result.current.isReady,
    ).toBe(true);
  });
});
