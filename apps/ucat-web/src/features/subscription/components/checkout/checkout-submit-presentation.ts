import type { UcatBillingInterval } from "@altitutor/shared";

type CheckoutSubmitPresentationOptions = {
  checkoutSubmitting: boolean;
  checkoutError: string | null;
  paymentLoading: boolean;
  offerTrialDays: number;
  referralGiftApplied: boolean;
  hasStandardTrial: boolean;
  standardTrialDays: number | null;
  interval: UcatBillingInterval;
};

type CheckoutSubmitPresentation = {
  label: string;
  status: string | null;
};

function intervalNoun(interval: UcatBillingInterval) {
  return interval === "week" ? "week" : interval === "month" ? "month" : "year";
}

export function getCheckoutSubmitPresentation({
  checkoutSubmitting,
  checkoutError,
  paymentLoading,
  offerTrialDays,
  referralGiftApplied,
  hasStandardTrial,
  standardTrialDays,
  interval,
}: CheckoutSubmitPresentationOptions): CheckoutSubmitPresentation {
  if (checkoutSubmitting) {
    return { label: "Confirming…", status: null };
  }

  if (checkoutError) {
    return { label: "Payment unavailable", status: null };
  }

  if (paymentLoading) {
    return {
      label: "Loading secure payment…",
      status:
        "Secure payment fields are loading. This button will activate when they’re ready.",
    };
  }

  if (offerTrialDays > 0) {
    return {
      label: `Start my ${offerTrialDays}-day free period`,
      status: null,
    };
  }

  if (referralGiftApplied) {
    return {
      label: `Start my free ${intervalNoun(interval)}`,
      status: null,
    };
  }

  if (hasStandardTrial) {
    return {
      label: `Start my ${standardTrialDays}-day free trial`,
      status: null,
    };
  }

  return { label: "Subscribe to UCAT Unlimited", status: null };
}
