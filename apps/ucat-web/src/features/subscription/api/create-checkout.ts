import type { UcatCheckoutRequest } from "@/lib/ucat/subscription-plan";

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
}> {
  const res = await fetch("/api/ucat/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(selection),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message = (body as { error?: string })?.error ?? res.statusText;
    throw new Error(message);
  }

  const data = (await res.json()) as {
    clientSecret?: string;
    checkoutSessionId?: string;
    referralGiftApplied?: boolean;
    trialEligible?: boolean;
    trialDays?: number;
  };
  if (!data.clientSecret || !data.checkoutSessionId) {
    throw new Error("Checkout could not be initialized");
  }

  return {
    clientSecret: data.clientSecret,
    checkoutSessionId: data.checkoutSessionId,
    referralGiftApplied: data.referralGiftApplied === true,
    trialEligible: data.trialEligible === true,
    trialDays:
      data.trialEligible === true && typeof data.trialDays === "number"
        ? data.trialDays
        : 0,
  };
}
