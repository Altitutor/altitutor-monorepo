import {
  isUcatBillingInterval,
  isUcatPaidPlanTier,
  type UcatBillingInterval,
  type UcatPaidPlanTier,
} from "@altitutor/shared";

export type UcatCheckoutSelection = {
  tier: UcatPaidPlanTier;
  interval: UcatBillingInterval;
};

export type UcatCheckoutRequest = UcatCheckoutSelection & {
  /** When set during signup onboarding, Stripe returns to /signup/complete. */
  returnContext?: "signup_onboarding" | "subscribe" | "practice_session";
};

export function isUcatCheckoutSelection(
  value: unknown,
): value is UcatCheckoutSelection {
  if (!value || typeof value !== "object") return false;
  const v = value as { tier?: unknown; interval?: unknown };
  return isUcatPaidPlanTier(v.tier) && isUcatBillingInterval(v.interval);
}

export function parseUcatCheckoutRequest(
  value: unknown,
): UcatCheckoutRequest | null {
  if (!isUcatCheckoutSelection(value)) return null;
  const v = value as UcatCheckoutRequest;
  const ctx = (value as { returnContext?: unknown }).returnContext;
  if (
    ctx !== undefined &&
    ctx !== "signup_onboarding" &&
    ctx !== "subscribe" &&
    ctx !== "practice_session"
  ) {
    return null;
  }
  return {
    tier: v.tier,
    interval: v.interval,
    returnContext:
      ctx === "signup_onboarding" || ctx === "practice_session"
        ? ctx
        : undefined,
  };
}

export {
  isUcatBillingInterval,
  isUcatPaidPlanTier,
  type UcatBillingInterval,
  type UcatPaidPlanTier,
};
