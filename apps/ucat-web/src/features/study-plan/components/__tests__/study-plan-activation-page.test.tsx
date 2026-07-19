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
  useSearchParams: () => new URLSearchParams("activation=1"),
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
    data: { profile: null, tasks: [], today: "2026-07-16" },
    isLoading: false,
    isError: false,
  }),
}));

jest.mock("@/features/ucat-access/hooks/use-ucat-access", () => ({
  useUcatAccess: () => ({ onlineTier: "free" }),
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

    expect(screen.getByLabelText("Target UCAT score")).toHaveValue(2200);
    expect(screen.getByText("Select your UCAT year")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Exact date (optional)"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Not sure what to set?" }),
    ).toBeInTheDocument();
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

  it("saves the goal without asking for availability when the student manages their own plan", async () => {
    mockSaveStudyPlan.mockResolvedValue({
      profile: {
        id: "profile-1",
        studyPlanEnabled: false,
        targetScore: 2200,
        testYear: new Date().getFullYear(),
        testDate: null,
        availableDays: [],
        preferredMockWeekday: 6,
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
      screen.getByRole("button", { name: /I’ll manage my own plan/i }),
    );
    fireEvent.click(screen.getByRole("combobox", { name: "UCAT year" }));
    fireEvent.click(screen.getByRole("option", { name: year }));
    fireEvent.click(screen.getByRole("button", { name: "Save my goal" }));

    await waitFor(() =>
      expect(mockSaveStudyPlan).toHaveBeenCalledWith(
        expect.objectContaining({
          studyPlanEnabled: false,
          targetScore: 2200,
          availableDays: [],
        }),
      ),
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
    expect(prefetch).toHaveBeenCalledWith("/dashboard");

    await act(async () => {
      jest.advanceTimersByTime(4_100);
      await Promise.resolve();
    });

    expect(
      screen.getByText("Completion animation: welcome, created"),
    ).toBeInTheDocument();
    jest.useRealTimers();
  });
});
