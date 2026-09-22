import type { UcatCheckoutRequest } from "@/lib/ucat/subscription-plan";

export class CheckoutSetupRequiredError extends Error {}

/**
 * Creates a Stripe Checkout Session for UCAT subscription.
 * Returns the client secret for Stripe's custom Checkout UI.
 */
export async function createUcatCheckoutSession(
  selection: UcatCheckoutRequest,
): Promise<{
  clientSecret: string;
  checkoutSessionId: string;
  referralGiftApplied: boolean;
  trialEligible: boolean;
  trialDays: number;
  founderPercentOff: number | null;
  offerTrialDays: number;
}> {
  const res = await fetch("/api/ucat/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selection),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { error?: string })?.error ?? res.statusText;
    if (body.code === "CHECKOUT_SETUP_REQUIRED") {
      throw new CheckoutSetupRequiredError(message);
    }
    throw new Error(message);
  }

  const data = (await res.json()) as {
    clientSecret?: string;
    checkoutSessionId?: string;
    referralGiftApplied?: boolean;
    trialEligible?: boolean;
    trialDays?: number;
    founderPercentOff?: number;
    offerTrialDays?: number;
  };
  if (!data.clientSecret || !data.checkoutSessionId) {
    throw new Error("Checkout could not be initialized");
  }

  return {
    clientSecret: data.clientSecret,
    checkoutSessionId: data.checkoutSessionId,
    referralGiftApplied: data.referralGiftApplied === true,
    offerTrialDays:
      typeof data.offerTrialDays === "number" ? data.offerTrialDays : 0,
    founderPercentOff:
      typeof data.founderPercentOff === "number"
        ? data.founderPercentOff
        : null,
    trialEligible: data.trialEligible === true,
    trialDays:
      data.trialEligible === true && typeof data.trialDays === "number"
        ? data.trialDays
        : 0,
  };
}
