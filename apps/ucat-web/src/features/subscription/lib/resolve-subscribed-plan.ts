import type { UcatOnlineTier } from "@altitutor/shared";
import { onlineTierRank } from "@/features/subscription/lib/plan-tier-rank";
import { hasPaidUcatSubscriptionAccess } from "@/lib/ucat/subscription-status";

export type CurrentPlanDisplayKey = UcatOnlineTier;

export type SubscriptionPlanSnapshot = {
  status: string;
  plan_tier: string | null;
} | null;

/** Paid tier from subscription row (authoritative for billing / plan label). */
export function subscribedPlanTierRank(
  subscription: SubscriptionPlanSnapshot,
): number {
  if (!subscription) return 0;
  if (
    subscription.plan_tier === "unlimited" &&
    (hasPaidUcatSubscriptionAccess(subscription.status) ||
      subscription.status === "trialing")
  ) {
    return 1;
  }
  // Active/past_due/trialing without a plan_tier still implies Unlimited access.
  if (
    hasPaidUcatSubscriptionAccess(subscription.status) ||
    subscription.status === "trialing"
  ) {
    return 1;
  }
  return 0;
}

export function effectivePaidTierRank(
  onlineTier: string | null | undefined,
  subscription: SubscriptionPlanSnapshot,
): number {
  return Math.max(onlineTierRank(onlineTier), subscribedPlanTierRank(subscription));
}

/**
 * Label for the Plan → Current plan card.
 * Prefer the entitlement tier from access; fall back to the subscription row.
 */
export function resolveCurrentPlanDisplayKey(
  onlineTier: UcatOnlineTier | null,
  subscription: SubscriptionPlanSnapshot,
): CurrentPlanDisplayKey {
  if (onlineTier === "unlimited_trial") return "unlimited_trial";
  if (onlineTier === "unlimited") return "unlimited";
  if (onlineTier === "free") {
    // Access says Free, but a recoverable/paid subscription row can still be
    // more accurate for the Plan label while Stripe/access catch up.
    if (
      subscription &&
      (hasPaidUcatSubscriptionAccess(subscription.status) ||
        subscription.status === "trialing")
    ) {
      return subscription.status === "trialing" ? "unlimited_trial" : "unlimited";
    }
    return "free";
  }

  // Access tier unknown — infer from subscription snapshot.
  if (
    subscription &&
    (hasPaidUcatSubscriptionAccess(subscription.status) ||
      subscription.status === "trialing")
  ) {
    return subscription.status === "trialing" ? "unlimited_trial" : "unlimited";
  }

  return "free";
}
