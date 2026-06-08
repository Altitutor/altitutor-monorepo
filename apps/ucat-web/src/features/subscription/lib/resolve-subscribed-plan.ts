import type { UcatOnlineTier } from "@altitutor/shared";
import { onlineTierRank } from "@/features/subscription/lib/plan-tier-rank";

export type CurrentPlanDisplayKey = UcatOnlineTier | "pro_trial";

export type SubscriptionPlanSnapshot = {
  status: string;
  plan_tier: string | null;
} | null;

/** Paid tier from subscription row (authoritative for billing / plan label). */
export function subscribedPlanTierRank(
  subscription: SubscriptionPlanSnapshot,
): number {
  if (!subscription) return 0;
  if (subscription.plan_tier === "pro") return 2;
  if (
    subscription.plan_tier === "unlimited" &&
    (subscription.status === "active" || subscription.status === "trialing")
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

export function resolveCurrentPlanDisplayKey(
  onlineTier: UcatOnlineTier | null,
  subscription: SubscriptionPlanSnapshot,
): CurrentPlanDisplayKey {
  if (subscription?.plan_tier === "pro") {
    return subscription.status === "trialing" ? "pro_trial" : "pro";
  }

  if (subscription?.status === "trialing") {
    return "unlimited_trial";
  }

  if (subscription?.status === "active") {
    return subscription.plan_tier === "unlimited" ? "unlimited" : "unlimited";
  }

  return onlineTier ?? "free";
}

export function isSubscribedToPro(
  subscription: SubscriptionPlanSnapshot,
): boolean {
  return subscription?.plan_tier === "pro";
}
