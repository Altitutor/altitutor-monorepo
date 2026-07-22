import type { UcatPaidPlanTier } from "@altitutor/shared";
import { isManageableUcatSubscriptionStatus } from "@/lib/ucat/subscription-status";

type SubscriptionSnapshot = {
  status: string;
  plan_tier: string | null;
};

export function resolveExistingSubscriberDestination(
  subscriptions: SubscriptionSnapshot[],
  _requestedTier: UcatPaidPlanTier,
): "/subscribe" | "/settings/plan/subscription" | null {
  const existingSubscription = subscriptions.find((subscription) =>
    isManageableUcatSubscriptionStatus(subscription.status),
  );
  if (!existingSubscription) return null;

  return "/settings/plan/subscription";
}
