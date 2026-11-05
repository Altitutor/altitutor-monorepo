import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { loadStripe } from "@stripe/stripe-js";
import { StripeElementsProvider } from "../StripeElementsProvider";

jest.mock("@stripe/stripe-js", () => ({
  loadStripe: jest.fn(),
}));

jest.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="stripe-elements">{children}</div>
  ),
}));

const loadStripeMock = jest.mocked(loadStripe);

describe("StripeElementsProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_fake";
  });

  it("shows a recoverable error and retries Stripe.js loading without losing its children", async () => {
    const stripe = { elements: jest.fn() } as never;
    let rejectFirstAttempt: (error: Error) => void = () => undefined;
    const firstAttempt = new Promise<never>((_resolve, reject) => {
      rejectFirstAttempt = reject;
    });
    loadStripeMock
      .mockReturnValueOnce(firstAttempt)
      .mockResolvedValueOnce(stripe);
    render(
      <StripeElementsProvider options={{ clientSecret: "seti_secret" }}>
        <div>Card fields</div>
      </StripeElementsProvider>,
    );

    await waitFor(() => expect(loadStripeMock).toHaveBeenCalledTimes(1));
    await act(async () => {
      rejectFirstAttempt(new Error("Failed to load Stripe.js"));
      await firstAttempt.catch(() => undefined);
    });

    expect(
      await screen.findByRole("alert", { name: "Payment form unavailable" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Card fields")).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    });

    await waitFor(() => expect(loadStripeMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Card fields")).toBeInTheDocument();
  });

  it("times out a stalled SDK and lets the user retry without accepting its late result", async () => {
    jest.useFakeTimers();
    try {
      const stripe = { elements: jest.fn() } as never;
      let resolveFirstAttempt: (value: typeof stripe) => void = () => undefined;
      const firstAttempt = new Promise<typeof stripe>((resolve) => {
        resolveFirstAttempt = resolve;
      });
      loadStripeMock
        .mockReturnValueOnce(firstAttempt)
        .mockResolvedValueOnce(stripe);
      render(
        <StripeElementsProvider options={{ clientSecret: "seti_secret" }}>
          <div>Card fields</div>
        </StripeElementsProvider>,
      );
      await waitFor(() => expect(loadStripeMock).toHaveBeenCalledTimes(1));
      await act(async () => {
        jest.advanceTimersByTime(15_000);
      });
      expect(
        screen.getByRole("alert", { name: "Payment form unavailable" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Card fields")).not.toBeInTheDocument();

      await act(async () => {
        resolveFirstAttempt(stripe);
        await firstAttempt;
      });
      expect(
        screen.getByRole("alert", { name: "Payment form unavailable" }),
      ).toBeInTheDocument();
      expect(screen.queryByText("Card fields")).not.toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      });
      expect(screen.getByText("Card fields")).toBeInTheDocument();
      await act(async () => {
        jest.advanceTimersByTime(15_000);
      });
      expect(screen.getByText("Card fields")).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });
});
