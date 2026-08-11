import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { StudyPlanActivationPage } from "@/features/study-plan/components/study-plan-activation-page";
import type {
  SignupSuccessTransitionPhase,
  StudyPlanCompletionStatus,
} from "@/features/signup-onboarding/components/signup-success-transition";

const replace = jest.fn();
const prefetch = jest.fn();
const mockSaveStudyPlan = jest.fn();
let searchParamsValue = "activation=1";
let mockPlanData: Record<string, unknown> = {
  profile: null,
  tasks: [],
  today: "2026-07-16",
};

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  value: ResizeObserverMock,
  writable: true,
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  value: jest.fn(),
  writable: true,
});

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace, prefetch }),
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}));

jest.mock("@/shared/components/ucat-clickable-card", () => ({
  UcatClickableCardButton: ({
    title,
    onClick,
  }: {
    title: string;
    onClick?: () => void;
  }) => (
    <button type="button" onClick={onClick}>
      {title}
    </button>
  ),
}));

jest.mock("@/features/study-plan/api/study-plan", () => ({
  saveStudyPlan: (...args: unknown[]) => mockSaveStudyPlan(...args),
}));

jest.mock("motion/react", () => ({
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  motion: {
    div: ({
      children,
      className,
    }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className}>{children}</div>
    ),
    p: ({
      children,
      className,
    }: React.PropsWithChildren<{ className?: string }>) => (
      <p className={className}>{children}</p>
    ),
  },
  useReducedMotion: () => false,
}));

jest.mock("@/features/landing/components/marketing/noise-overlay", () => ({
  NoiseOverlay: () => null,
}));

jest.mock("@/features/study-plan/hooks/use-study-plan", () => ({
  useStudyPlan: () => ({
    data: mockPlanData,
    isLoading: false,
    isError: false,
  }),
}));

jest.mock("@/features/ucat-access/hooks/use-ucat-access", () => ({
  useUcatAccess: () => ({ onlineTier: "free" }),
}));

const mockCompleteMilestone = jest.fn();

jest.mock("@/features/onboarding/hooks/use-onboarding-progress", () => ({
  useCompleteOnboardingTour: () => ({ mutateAsync: mockCompleteMilestone }),
}));

jest.mock(
  "@/features/signup-onboarding/components/signup-success-transition",
  () => ({
    SignupSuccessTransition: ({
      phase,
      studyPlanStatus,
    }: {
      phase: SignupSuccessTransitionPhase;
      studyPlanStatus?: StudyPlanCompletionStatus;
    }) => (
      <div>
        Completion animation: {phase}, {studyPlanStatus}
      </div>
    ),
  }),
);

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <StudyPlanActivationPage />
    </QueryClientProvider>,
  );
}

describe("StudyPlanActivationPage", () => {
  beforeEach(() => {
    replace.mockClear();
    prefetch.mockClear();
    mockSaveStudyPlan.mockReset();
    mockCompleteMilestone.mockReset();
    searchParamsValue = "activation=1";
    mockPlanData = {
      profile: null,
      tasks: [],
      today: "2026-07-16",
    };
  });

  it("starts at 2200 with no year or exact-date field selected", () => {
    renderPage();
    expect(
      screen.getByRole("heading", {
        name: "How would you like to organise your study?",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Build me a Study plan/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("spinbutton", { name: "Target UCAT score" }),
    ).toHaveValue(2200);
    expect(screen.getByText("Select your UCAT year")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Exact date (optional)"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Not sure what to set?" }),
    ).toBeInTheDocument();
  });

  it("lets the student type a low target before validating the complete score", () => {
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: /Build me a Study plan/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const targetInput = screen.getByRole("spinbutton", {
      name: "Target UCAT score",
    }) as HTMLInputElement;

    for (const partialScore of ["1", "13", "130", "1300"]) {
      fireEvent.change(targetInput, { target: { value: partialScore } });
      expect(targetInput.value).toBe(partialScore);
    }

    expect(screen.getByText("This target may be too low.")).toBeInTheDocument();
    expect(
      screen.getByText(/unlikely to be competitive for many interview offers/i),
    ).toBeInTheDocument();

    fireEvent.change(targetInput, { target: { value: "2000" } });
    expect(
      screen.queryByText("This target may be too low."),
    ).not.toBeInTheDocument();
  });

  it("asks for confirmation before skipping", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(screen.getByText("Skip Study plan setup?")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Keep setting up" }),
    ).toBeInTheDocument();
  });

  it("starts the weekly setup with five study days enabled", () => {
    renderPage();
    const year = String(new Date().getFullYear());

    fireEvent.click(
      screen.getByRole("button", { name: /Build me a Study plan/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("combobox", { name: "UCAT year" }));
    fireEvent.click(screen.getByRole("option", { name: year }));
    fireEvent.click(
      screen.getByRole("button", { name: /Choose my study week/i }),
    );

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(7);
    expect(
      switches.filter(
        (control) => control.getAttribute("data-state") === "checked",
      ),
    ).toHaveLength(5);
  });

  it("marks Study plan decided when skipping setup", async () => {
    mockCompleteMilestone.mockResolvedValue("ucat-study-plan-decided");
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    fireEvent.click(
      screen.getAllByRole("button", { name: "Skip for now" }).at(-1)!,
    );

    await waitFor(() =>
      expect(mockCompleteMilestone).toHaveBeenCalledWith(
        "ucat-study-plan-decided",
      ),
    );
  });

  it("returns to the dashboard without collecting a goal when the student manages their own plan", async () => {
    mockCompleteMilestone.mockResolvedValue("ucat-study-plan-decided");
    searchParamsValue = "section=plan";
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: /I’ll manage my own plan/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() =>
      expect(mockCompleteMilestone).toHaveBeenCalledWith(
        "ucat-study-plan-decided",
      ),
    );
    expect(mockSaveStudyPlan).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith("/dashboard");
    expect(
      screen.queryByRole("spinbutton", { name: "Target UCAT score" }),
    ).not.toBeInTheDocument();
  });

  it("from settings: manage own without a goal collects a goal and returns to settings", async () => {
    mockCompleteMilestone.mockResolvedValue("ucat-study-plan-decided");
    mockSaveStudyPlan.mockResolvedValue({
      profile: {
        id: "profile-1",
        studyPlanEnabled: false,
        targetScore: 2200,
        testYear: new Date().getFullYear(),
        testDate: null,
        availableDays: [],
        preferredMockWeekday: 6,
      },
      tasks: [],
      today: "2026-07-16",
    });
    searchParamsValue = "section=plan&from=settings";
    renderPage();

    expect(
      screen.getByRole("button", { name: /Back to settings/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Skip for now" }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /I’ll manage my own plan/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("spinbutton", { name: "Target UCAT score" }),
    ).toBeInTheDocument();
    const year = String(new Date().getFullYear());
    fireEvent.click(screen.getByRole("combobox", { name: "UCAT year" }));
    fireEvent.click(screen.getByRole("option", { name: year }));
    expect(
      screen.getByRole("radio", { name: /A little/i }),
    ).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Normally/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save and finish/i }));

    await waitFor(() => expect(mockSaveStudyPlan).toHaveBeenCalled());
    expect(mockSaveStudyPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        studyPlanEnabled: false,
        sjtPreference: "normally",
      }),
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/settings/study-plan"),
    );
  });

  it("moves a saved Study plan into setup animation before the welcome reveal", async () => {
    jest.useFakeTimers();
    mockSaveStudyPlan.mockResolvedValue({
      profile: {
        id: "profile-1",
        studyPlanEnabled: true,
        targetScore: 2200,
        testYear: new Date().getFullYear(),
        testDate: null,
        availableDays: [
          { weekday: 1, maxMinutes: 60 },
          { weekday: 2, maxMinutes: 60 },
          { weekday: 3, maxMinutes: 60 },
          { weekday: 4, maxMinutes: 60 },
          { weekday: 5, maxMinutes: 60 },
        ],
        preferredMockWeekday: 5,
        planningDate: "2026-07-18",
        planningDateIsProvisional: true,
        nextWeeklyReplanOn: null,
      },
      generation: null,
      tasks: [],
      nextSteps: [],
      today: "2026-07-18",
      todayTasks: [],
      completion: { completed: 0, scheduledThroughToday: 0, percent: 0 },
    });
    renderPage();
    const year = String(new Date().getFullYear());

    fireEvent.click(
      screen.getByRole("button", { name: /Build me a Study plan/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("combobox", { name: "UCAT year" }));
    fireEvent.click(screen.getByRole("option", { name: year }));
    fireEvent.click(
      screen.getByRole("button", { name: /Choose my study week/i }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Build my Study plan" }),
    );

    await waitFor(() =>
      expect(
        screen.getByText("Completion animation: confirming, created"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByText("Your Study plan is ready"),
    ).not.toBeInTheDocument();
    expect(prefetch).toHaveBeenCalledWith("/study-plan");

    await act(async () => {
      jest.advanceTimersByTime(4_100);
      await Promise.resolve();
    });

    expect(
      screen.getByText("Completion animation: welcome, created"),
    ).toBeInTheDocument();
    jest.useRealTimers();
  });

  it("skips goal setup when a saved goal exists", () => {
    searchParamsValue = "section=plan";
    mockPlanData = {
      profile: {
        studyPlanEnabled: false,
        targetScore: 2300,
        testYear: new Date().getFullYear(),
        testDate: null,
        availableDays: [],
        preferredMockWeekday: 6,
      },
      tasks: [],
      today: "2026-07-16",
    };
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: /Build me a Study plan/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(
      screen.getByRole("heading", {
        name: "When could you realistically study?",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("spinbutton", { name: "Target UCAT score" }),
    ).not.toBeInTheDocument();
  });

  it("finishes immediately when a student with a saved goal manages their own plan", async () => {
    searchParamsValue = "section=plan";
    mockPlanData = {
      profile: {
        studyPlanEnabled: false,
        targetScore: 2300,
        testYear: new Date().getFullYear(),
        testDate: null,
        availableDays: [],
        preferredMockWeekday: 6,
      },
      tasks: [],
      today: "2026-07-16",
    };
    mockSaveStudyPlan.mockResolvedValue(mockPlanData);
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: /I’ll manage my own plan/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() =>
      expect(mockSaveStudyPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          studyPlanEnabled: false,
          targetScore: 2300,
        }),
      ),
    );
    expect(
      screen.queryByRole("spinbutton", { name: "Target UCAT score" }),
    ).not.toBeInTheDocument();
  });
});
