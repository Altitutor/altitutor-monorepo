const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

export type StripeSubscriptionSnapshot = {
  status?: string;
  cancel_at_period_end?: boolean;
  cancel_at?: number | null;
  current_period_start?: number;
  current_period_end?: number;
  items?: {
    data?: Array<{
      current_period_start?: number;
      current_period_end?: number;
    }>;
  };
};

export function subscriptionPeriodFields(subscription: StripeSubscriptionSnapshot): {
  current_period_start: string | null;
  current_period_end: string | null;
} {
  const item = subscription.items?.data?.[0];
  const start =
    subscription.current_period_start ?? item?.current_period_start ?? null;
  const end =
    subscription.current_period_end ?? item?.current_period_end ?? null;

  return {
    current_period_start:
      start != null ? new Date(start * 1000).toISOString() : null,
    current_period_end:
      end != null ? new Date(end * 1000).toISOString() : null,
  };
}

export function subscriptionCancelFields(subscription: StripeSubscriptionSnapshot): {
  cancel_at_period_end: boolean;
  cancel_at: string | null;
} {
  const cancelAtPeriodEnd = subscription.cancel_at_period_end ?? false;
  const status = subscription.status ?? "active";
  const stillActive = ACTIVE_STATUSES.has(status);

  if (subscription.cancel_at) {
    const cancelAtMs = subscription.cancel_at * 1000;
    const isScheduled = stillActive && cancelAtMs > Date.now();
    return {
      cancel_at_period_end: cancelAtPeriodEnd || isScheduled,
      cancel_at: new Date(cancelAtMs).toISOString(),
    };
  }

  if (cancelAtPeriodEnd) {
    const periodEnd =
      subscription.current_period_end ??
      subscription.items?.data?.[0]?.current_period_end;
    if (periodEnd) {
      return {
        cancel_at_period_end: true,
        cancel_at: new Date(periodEnd * 1000).toISOString(),
      };
    }
  }

  return { cancel_at_period_end: cancelAtPeriodEnd, cancel_at: null };
}

export function isSubscriptionCancelScheduled(subscription: {
  status: string;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
}): boolean {
  if (subscription.cancel_at_period_end) return true;
  if (!subscription.cancel_at || !ACTIVE_STATUSES.has(subscription.status)) {
    return false;
  }
  return new Date(subscription.cancel_at).getTime() > Date.now();
}

export function getSubscriptionEndDateIso(subscription: {
  status: string;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  current_period_end: string | null;
}): string | null {
  if (!isSubscriptionCancelScheduled(subscription)) return null;
  if (subscription.cancel_at) return subscription.cancel_at.slice(0, 10);
  if (subscription.current_period_end) {
    return subscription.current_period_end.slice(0, 10);
  }
  return null;
}
