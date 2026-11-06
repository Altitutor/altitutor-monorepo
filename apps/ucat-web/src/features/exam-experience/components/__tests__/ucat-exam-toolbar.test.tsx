import { render, screen } from "@testing-library/react";
import { UcatExamToolbar } from "@/features/exam-experience/components/ucat-exam-toolbar";

jest.mock("@altitutor/ui", () => {
  const actual =
    jest.requireActual<typeof import("@altitutor/ui")>("@altitutor/ui");
  return {
    ...actual,
    useToast: () => ({ toast: jest.fn() }),
  };
});

jest.mock("@/features/exam-experience/context/exam-experience-context", () => ({
  useExamExperience: () => ({
    title: "Verbal Reasoning",
    practice: null,
    requestExit: jest.fn(),
  }),
}));

jest.mock(
  "@/features/exam-attempts/context/active-exam-attempt-context",
  () => ({
    useActiveExamAttempt: () => ({ active: null }),
  }),
);

jest.mock("@/features/question-engine/context/ucat-lag-context", () => ({
  useUcatLag: () => ({ enabled: false, setEnabled: jest.fn() }),
}));

jest.mock(
  "@/features/interface-preferences/hooks/use-ucat-interface-preferences",
  () => ({
    useUcatInterfacePreferences: () => ({
      preferences: { nextQuestionPopupEnabled: false },
      updatePreferences: jest.fn(),
    }),
  }),
);

jest.mock("@/shared/hooks/use-media-query", () => ({
  useMediaQuery: () => false,
}));

jest.mock("@/lib/sentry/open-user-feedback", () => ({
  openUserFeedback: jest.fn(),
}));

describe("UcatExamToolbar fullscreen", () => {
  beforeEach(() => {
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => null,
    });
    document.documentElement.requestFullscreen = jest
      .fn()
      .mockResolvedValue(undefined);
  });

  it.each(["compact_top", "detailed_right"] as const)(
    "offers fullscreen from the %s toolbar",
    (layout) => {
      render(<UcatExamToolbar layout={layout} />);

      expect(
        screen.getByRole("button", { name: "Full screen" }),
      ).toBeInTheDocument();
    },
  );

  it("hides fullscreen when the browser cannot enter it", () => {
    Object.defineProperty(document, "fullscreenEnabled", {
      configurable: true,
      get: () => false,
    });

    render(<UcatExamToolbar layout="compact_top" />);

    expect(screen.queryByRole("button", { name: "Full screen" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Exit session" }),
    ).toBeInTheDocument();
  });
});
