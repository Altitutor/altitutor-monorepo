import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { StudyPlanActivationPage } from "@/features/study-plan/components/study-plan-activation-page";

const replace = jest.fn();

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
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams("activation=1"),
}));

jest.mock("motion/react", () => ({
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  motion: {
    div: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
      <div className={className}>{children}</div>
    ),
    p: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
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
  () => ({ SignupSuccessTransition: () => <div>Completion animation</div> }),
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
  it("starts at 2200 with no year or exact-date field selected", () => {
    renderPage();

    expect(screen.getByLabelText("Target cognitive score")).toHaveValue(2200);
    expect(screen.getByText("Select your UCAT year")).toBeInTheDocument();
    expect(screen.queryByLabelText("Exact date (optional)")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not sure what to set?" })).toBeInTheDocument();
  });

  it("asks for confirmation before skipping", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(screen.getByText("Skip Study plan setup?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep setting up" })).toBeInTheDocument();
  });

  it("starts the weekly setup with five study days enabled", () => {
    renderPage();
    const year = String(new Date().getFullYear());

    fireEvent.click(screen.getByRole("combobox", { name: "UCAT year" }));
    fireEvent.click(screen.getByRole("option", { name: year }));
    fireEvent.click(screen.getByRole("button", { name: /Choose my study week/i }));

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(7);
    expect(switches.filter((control) => control.getAttribute("data-state") === "checked")).toHaveLength(5);
  });
});
