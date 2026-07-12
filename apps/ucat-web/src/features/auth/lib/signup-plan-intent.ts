import {
  isUcatBillingInterval,
  isUcatPaidPlanTier,
  type UcatBillingInterval,
  type UcatPaidPlanTier,
} from "@altitutor/shared";

export type SignupPlanIntent = {
  tier: UcatPaidPlanTier;
  interval: UcatBillingInterval;
  checkoutPath: string;
};

export function buildSignupCheckoutPath(
  tier: UcatPaidPlanTier,
  interval: UcatBillingInterval,
): string {
  const params = new URLSearchParams({
    tier,
    interval,
    context: "signup_onboarding",
  });
  return `/checkout?${params.toString()}`;
}

export function parseSignupPlanIntent(
  redirectTo: string | null | undefined,
): SignupPlanIntent | null {
  if (!redirectTo?.startsWith("/checkout?")) return null;

  const url = new URL(redirectTo, "https://ucat.altitutor.com");
  const tier = url.searchParams.get("tier");
  const interval = url.searchParams.get("interval");
  const context = url.searchParams.get("context");

  if (
    !isUcatPaidPlanTier(tier) ||
    !isUcatBillingInterval(interval) ||
    context !== "signup_onboarding"
  ) {
    return null;
  }

  return {
    tier,
    interval,
    checkoutPath: buildSignupCheckoutPath(tier, interval),
  };
}
