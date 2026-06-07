export const UCAT_PAID_PLAN_TIERS = ["unlimited", "pro"] as const;
export type UcatPaidPlanTier = (typeof UCAT_PAID_PLAN_TIERS)[number];

export const UCAT_BILLING_INTERVALS = ["week", "month", "year"] as const;
export type UcatBillingInterval = (typeof UCAT_BILLING_INTERVALS)[number];

export const UCAT_ONLINE_TIERS = [
  "free",
  "unlimited_trial",
  "unlimited",
  "pro",
] as const;
export type UcatOnlineTier = (typeof UCAT_ONLINE_TIERS)[number];

export const UCAT_TIER_OVERRIDES = [
  "default",
  "force_free",
  "force_unlimited",
  "force_pro",
] as const;
export type UcatTierOverride = (typeof UCAT_TIER_OVERRIDES)[number];

export function isUcatPaidPlanTier(value: unknown): value is UcatPaidPlanTier {
  return value === "unlimited" || value === "pro";
}

export function isUcatBillingInterval(
  value: unknown,
): value is UcatBillingInterval {
  return value === "week" || value === "month" || value === "year";
}

export function isUcatOnlineTier(value: unknown): value is UcatOnlineTier {
  return (
    value === "free" ||
    value === "unlimited_trial" ||
    value === "unlimited" ||
    value === "pro"
  );
}

/** Calendar days in a billing period for marketing price conversion. */
export function ucatBillingPeriodDays(interval: UcatBillingInterval): number {
  switch (interval) {
    case "week":
      return 7;
    case "month":
      return 30;
    case "year":
      return 365;
  }
}

/** Period price → per-week headline (day-accurate). */
export function periodCentsToPerWeekCents(
  periodCents: number,
  interval: UcatBillingInterval,
): number {
  const days = ucatBillingPeriodDays(interval);
  return Math.round((periodCents * 7) / days);
}

export type UcatPracticeDayDiscountRule = {
  interval: UcatBillingInterval;
  discountPerDayCents: number;
  maxDiscountsPerPeriod: number;
};

/** Upper bound for admin validation of practice-day discount cap. */
export function ucatPracticeDayDiscountCapLimit(
  interval: UcatBillingInterval,
): number {
  return ucatBillingPeriodDays(interval);
}

export function maxPracticeDayDiscountCents(
  discountPerDayCents: number,
  maxDiscountsPerPeriod: number,
): number {
  return discountPerDayCents * maxDiscountsPerPeriod;
}
