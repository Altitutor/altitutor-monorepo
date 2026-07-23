type ShouldShowSubscriptionTabInput = {
  accessLoading: boolean;
  billingLoading: boolean;
  onlineTier: string | null;
  subscriptionCount: number;
  invoiceCount: number;
};

/**
 * Hide the Plan → Subscription tab for free users with no billing history.
 *
 * While access/billing are still loading, keep the tab hidden. Showing it by
 * default caused a flash for Free users on every cold load; paid users with
 * history only gain the tab once data resolves (or immediately from cache).
 */
export function shouldShowSubscriptionTab({
  accessLoading,
  billingLoading,
  onlineTier,
  subscriptionCount,
  invoiceCount,
}: ShouldShowSubscriptionTabInput): boolean {
  if (accessLoading || billingLoading) {
    if (onlineTier != null && onlineTier !== "free") return true;
    if (subscriptionCount > 0 || invoiceCount > 0) return true;
    return false;
  }
  if (onlineTier != null && onlineTier !== "free") return true;
  return subscriptionCount > 0 || invoiceCount > 0;
}
