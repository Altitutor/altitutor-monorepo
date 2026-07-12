type ShouldShowSubscriptionTabInput = {
  accessLoading: boolean;
  billingLoading: boolean;
  onlineTier: string | null;
  subscriptionCount: number;
  invoiceCount: number;
};

/**
 * Hide the Plan → Subscription tab for free users with no billing history.
 * Keep it visible while access/billing are loading to avoid tab flicker.
 */
export function shouldShowSubscriptionTab({
  accessLoading,
  billingLoading,
  onlineTier,
  subscriptionCount,
  invoiceCount,
}: ShouldShowSubscriptionTabInput): boolean {
  if (accessLoading || billingLoading) return true;
  if (onlineTier !== "free") return true;
  return subscriptionCount > 0 || invoiceCount > 0;
}
