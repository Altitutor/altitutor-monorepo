export const PAID_ACCESS_UCAT_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
] as const;

export const MANAGEABLE_UCAT_SUBSCRIPTION_STATUSES = [
  ...PAID_ACCESS_UCAT_SUBSCRIPTION_STATUSES,
  "unpaid",
] as const;

const PAID_ACCESS_STATUS_SET = new Set<string>(
  PAID_ACCESS_UCAT_SUBSCRIPTION_STATUSES,
);
const MANAGEABLE_STATUS_SET = new Set<string>(
  MANAGEABLE_UCAT_SUBSCRIPTION_STATUSES,
);

export function hasPaidUcatSubscriptionAccess(status: string): boolean {
  return PAID_ACCESS_STATUS_SET.has(status);
}

export function isManageableUcatSubscriptionStatus(status: string): boolean {
  return MANAGEABLE_STATUS_SET.has(status);
}

export function isUcatBillingRecoveryStatus(status: string): boolean {
  return status === "past_due";
}

export function isUcatBillingTerminalStatus(status: string): boolean {
  return status === "unpaid" || status === "canceled";
}
