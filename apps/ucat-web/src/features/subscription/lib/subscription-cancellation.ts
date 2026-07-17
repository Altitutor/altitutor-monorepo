export const STRIPE_CANCELLATION_FEEDBACK_VALUES = [
  "customer_service",
  "low_quality",
  "missing_features",
  "other",
  "switched_service",
  "too_complex",
  "too_expensive",
  "unused",
] as const;

export type StripeCancellationFeedback =
  (typeof STRIPE_CANCELLATION_FEEDBACK_VALUES)[number];

export type CancellationReasonSelection =
  | StripeCancellationFeedback
  | "prefer_not_to_say";

export const CANCELLATION_REASON_OPTIONS: ReadonlyArray<{
  value: CancellationReasonSelection;
  label: string;
}> = [
  { value: "too_expensive", label: "It’s too expensive" },
  { value: "unused", label: "I don’t use it enough" },
  { value: "missing_features", label: "Some features are missing" },
  { value: "low_quality", label: "The quality was less than expected" },
  { value: "switched_service", label: "I’m switching to another service" },
  { value: "too_complex", label: "It’s too difficult to use" },
  {
    value: "customer_service",
    label: "Customer service was less than expected",
  },
  { value: "other", label: "Another reason" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

export function isStripeCancellationFeedback(
  value: unknown,
): value is StripeCancellationFeedback {
  return STRIPE_CANCELLATION_FEEDBACK_VALUES.includes(
    value as StripeCancellationFeedback,
  );
}

