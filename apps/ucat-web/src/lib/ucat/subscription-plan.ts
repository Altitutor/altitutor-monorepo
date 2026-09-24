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

export type UcatCheckoutReturnContext =
  | "signup_onboarding"
  | "subscribe"
  | "practice_session"
  | "referral_gift";

export type UcatCheckoutRequest = UcatCheckoutSelection & {
  /** Selects the application success gate used after Stripe checkout. */
  returnContext?: UcatCheckoutReturnContext;
  /** A pending recipient gift or an earned Free-referrer access gift. */
  referralGiftId?: string;
  /** Validated application destination resumed after successful checkout. */
  returnTo?: string;
};

/**
 * Routes Stripe through an existing paid-access success gate, carrying any
 * validated activity-page intent through that gate as a nested destination.
 */
export function buildUcatCheckoutReturnPath(
  returnContext: UcatCheckoutReturnContext,
  returnTo = "/dashboard",
): string {
  const pathname =
    returnContext === "signup_onboarding"
      ? "/signup/complete"
      : returnContext === "practice_session"
        ? "/exam"
        : "/dashboard";
  const params = new URLSearchParams({ checkout: "success" });

  if (returnContext !== "practice_session" && returnTo !== "/dashboard") {
    params.set("redirect", returnTo);
  }

  return `${pathname}?${params.toString()}`;
}

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
    returnTo?: unknown;
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
    returnTo: typeof raw.returnTo === "string" ? raw.returnTo : undefined,
  };
}

export {
  isUcatBillingInterval,
  isUcatPaidPlanTier,
  type UcatBillingInterval,
  type UcatPaidPlanTier,
};
