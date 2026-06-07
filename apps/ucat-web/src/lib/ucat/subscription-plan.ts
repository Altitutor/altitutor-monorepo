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

export function isUcatCheckoutSelection(
  value: unknown,
): value is UcatCheckoutSelection {
  if (!value || typeof value !== "object") return false;
  const v = value as { tier?: unknown; interval?: unknown };
  return isUcatPaidPlanTier(v.tier) && isUcatBillingInterval(v.interval);
}

export {
  isUcatBillingInterval,
  isUcatPaidPlanTier,
  type UcatBillingInterval,
  type UcatPaidPlanTier,
};
