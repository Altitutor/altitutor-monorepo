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
  returnContext?:
    | "signup_onboarding"
    | "subscribe"
    | "practice_session"
    | "referral_gift";
  /** A pending recipient gift or an earned Free-referrer access gift. */
  referralGiftId?: string;
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
  const raw = value as unknown as {
    returnContext?: unknown;
    referralGiftId?: unknown;
  };
  const ctx = raw.returnContext;
  if (
    ctx !== undefined &&
    ctx !== "signup_onboarding" &&
    ctx !== "subscribe" &&
    ctx !== "practice_session" &&
    ctx !== "referral_gift"
  ) {
    return null;
  }
  return {
    tier: v.tier,
    interval: v.interval,
    returnContext:
      ctx === "signup_onboarding" ||
      ctx === "practice_session" ||
      ctx === "referral_gift"
        ? ctx
        : undefined,
    referralGiftId:
      typeof raw.referralGiftId === "string" ? raw.referralGiftId : undefined,
  };
}

export {
  isUcatBillingInterval,
  isUcatPaidPlanTier,
  type UcatBillingInterval,
  type UcatPaidPlanTier,
};
