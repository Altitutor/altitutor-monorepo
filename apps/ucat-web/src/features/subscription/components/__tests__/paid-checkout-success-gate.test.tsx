import React, { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { PaidCheckoutSuccessGate } from "../paid-checkout-success-gate";

const mockQueryClient = {
  refetchQueries: jest.fn().mockResolvedValue(undefined),
  invalidateQueries: jest.fn().mockResolvedValue(undefined),
};
const mockRouter = { replace: jest.fn(), refresh: jest.fn() };
let mockAccess = {
  onlineTier: "unlimited",
  isLoading: false,
  accessLoadFailed: false,
};

jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mockQueryClient,
}));
jest.mock("motion/react", () => ({ useReducedMotion: () => false }));
jest.mock("@/features/ucat-access/hooks/use-ucat-access", () => ({
  useUcatAccess: () => mockAccess,
}));
jest.mock(
  "@/features/signup-onboarding/components/signup-success-transition",
  () => ({
    SignupSuccessTransition: ({ phase }: { phase: string }) => (
      <p role="status">{phase}</p>
    ),
  }),
);

describe("paid checkout confirmation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAccess = {
      onlineTier: "unlimited",
      isLoading: false,
      accessLoadFailed: false,
    };
  });
  afterEach(() => jest.useRealTimers());

  it("finishes confirmation when a founder pass already grants Unlimited, including Strict Mode replay", () => {
    render(
      <StrictMode>
        <PaidCheckoutSuccessGate active returnPath="/dashboard">
          Dashboard
        </PaidCheckoutSuccessGate>
      </StrictMode>,
    );
    act(() => jest.advanceTimersByTime(3_000));
    expect(screen.getByRole("status")).toHaveTextContent("welcome");
  });

  it("recovers when access refresh interrupts the confirmation animation", () => {
    const view = render(
      <PaidCheckoutSuccessGate active returnPath="/dashboard">
        Dashboard
      </PaidCheckoutSuccessGate>,
    );
    act(() => jest.advanceTimersByTime(1_000));
    mockAccess = { ...mockAccess, isLoading: true };
    view.rerender(
      <PaidCheckoutSuccessGate active returnPath="/dashboard">
        Dashboard
      </PaidCheckoutSuccessGate>,
    );
    mockAccess = { ...mockAccess, isLoading: false };
    view.rerender(
      <PaidCheckoutSuccessGate active returnPath="/dashboard">
        Dashboard
      </PaidCheckoutSuccessGate>,
    );
    act(() => jest.advanceTimersByTime(2_000));
    expect(screen.getByRole("status")).toHaveTextContent("welcome");
  });
});
