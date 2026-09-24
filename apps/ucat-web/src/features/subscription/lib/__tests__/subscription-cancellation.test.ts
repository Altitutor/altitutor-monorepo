import {
  isStripeCancellationFeedback,
  STRIPE_CANCELLATION_FEEDBACK_VALUES,
} from "@/features/subscription/lib/subscription-cancellation";

describe("subscription cancellation feedback", () => {
  it.each(STRIPE_CANCELLATION_FEEDBACK_VALUES)(
    "accepts Stripe feedback value %s",
    (value) => {
      expect(isStripeCancellationFeedback(value)).toBe(true);
    },
  );

  it.each([null, undefined, "prefer_not_to_say", "price", 42])(
    "rejects unsupported feedback value %p",
    (value) => {
      expect(isStripeCancellationFeedback(value)).toBe(false);
    },
  );
});
