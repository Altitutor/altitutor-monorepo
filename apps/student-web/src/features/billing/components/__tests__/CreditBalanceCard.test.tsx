import React from "react";
import { render, screen } from "@testing-library/react";
import { CreditBalanceCard } from "../CreditBalanceCard";
import { useCreditBalance } from "../../hooks/useCreditBalance";

Object.assign(globalThis, { React });

jest.mock("@altitutor/ui", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div className={className} />
  ),
}));

jest.mock("../../hooks/useCreditBalance", () => ({
  useCreditBalance: jest.fn(),
}));

const mockedUseCreditBalance = jest.mocked(useCreditBalance);

describe("CreditBalanceCard", () => {
  it("presents a Stripe credit balance with the same negative-value convention as admin", () => {
    mockedUseCreditBalance.mockReturnValue({
      data: {
        linked: true,
        balance_cents: -4250,
        currency: "aud",
        updated_at: "2026-09-23T00:00:00.000Z",
      },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useCreditBalance>);

    render(<CreditBalanceCard />);

    expect(screen.getByText("-$42.50 AUD")).toBeInTheDocument();
    expect(screen.getByText("Credit available")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Your credit will be automatically applied to future invoices.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a clear zero-credit state", () => {
    mockedUseCreditBalance.mockReturnValue({
      data: {
        linked: false,
        balance_cents: 0,
        currency: "aud",
        updated_at: "2026-09-23T00:00:00.000Z",
      },
      isLoading: false,
      isError: false,
    } as ReturnType<typeof useCreditBalance>);

    render(<CreditBalanceCard />);

    expect(screen.getByText("$0.00 AUD")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No credit is currently available on your billing account.",
      ),
    ).toBeInTheDocument();
  });
});
