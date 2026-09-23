import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CheckoutPaymentForm } from "../checkout-payment-form";
const mockConfirm = jest.fn();
jest.mock("@stripe/react-stripe-js/checkout", () => ({
  useCheckout: () => ({ type: "success", checkout: { confirm: mockConfirm } }),
  PaymentElement: ({ onReady }: { onReady?: () => void }) => (
    <button type="button" onClick={onReady}>
      Stripe ready
    </button>
  ),
  ExpressCheckoutElement: () => null,
}));
jest.mock("@/features/subscription/api/track-subscription-journey", () => ({
  trackSubscriptionJourneyEvent: jest.fn(),
}));
const props = {
  tier: "unlimited",
  interval: "month",
  context: "subscribe",
  checkoutSessionId: "cs_test",
} as const;
beforeEach(() => {
  jest.clearAllMocks();
  mockConfirm.mockResolvedValue({
    type: "error",
    error: { message: "Try again" },
  });
});
it("cannot confirm before the Payment Element is ready, even with a direct form submission", () => {
  const { container } = render(<CheckoutPaymentForm {...props} />);
  fireEvent.submit(container.querySelector("form")!);
  expect(mockConfirm).not.toHaveBeenCalled();
});
it("handles a thrown Stripe error and permits retry after the form is ready", async () => {
  mockConfirm.mockRejectedValueOnce(new Error("Connection interrupted"));
  const { container } = render(<CheckoutPaymentForm {...props} />);
  fireEvent.click(screen.getByText("Stripe ready"));
  fireEvent.submit(container.querySelector("form")!);
  expect(await screen.findByText("Connection interrupted")).toBeVisible();
  fireEvent.submit(container.querySelector("form")!);
  await waitFor(() => expect(mockConfirm).toHaveBeenCalledTimes(2));
});

it("reports readiness to the external purchase button and clears it on unmount", () => {
  const ready = jest.fn();
  const view = render(<CheckoutPaymentForm {...props} onReadyChange={ready} />);
  expect(ready).toHaveBeenLastCalledWith(false);
  fireEvent.click(screen.getByText("Stripe ready"));
  expect(ready).toHaveBeenLastCalledWith(true);
  view.unmount();
  expect(ready).toHaveBeenLastCalledWith(false);
});
