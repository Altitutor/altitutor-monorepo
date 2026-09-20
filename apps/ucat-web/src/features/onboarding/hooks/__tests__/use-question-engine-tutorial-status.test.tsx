import { renderHook } from "@testing-library/react";
import { useUcatProfile } from "@/features/layout/hooks/use-ucat-profile";
import { useQuestionEngineTutorialStatus } from "@/features/onboarding/hooks/use-question-engine-tutorial-status";

jest.mock("@/features/layout/hooks/use-ucat-profile", () => ({
  useUcatProfile: jest.fn(),
}));

const mockedUseUcatProfile = jest.mocked(useUcatProfile);

describe("useQuestionEngineTutorialStatus", () => {
  it.each([
    ["new", "full"],
    ["familiar", "full"],
    ["experienced", "controls"],
    [null, "choose"],
  ])("selects %s familiarity guidance", (familiarity, tutorialKind) => {
    mockedUseUcatProfile.mockReturnValue({
      data: { ucatInitialFamiliarity: familiarity },
      isLoading: false,
    } as ReturnType<typeof useUcatProfile>);

    expect(
      renderHook(() => useQuestionEngineTutorialStatus()).result.current,
    ).toEqual({ isLoading: false, tutorialKind });
  });
});
