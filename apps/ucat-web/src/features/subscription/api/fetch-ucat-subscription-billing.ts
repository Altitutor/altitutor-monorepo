import { fetchUcatSubscriptionBilling as fetchBilling } from "@/features/subscription/api/billing";
import type { UcatSubscriptionBillingResponse } from "@/features/subscription/types/ucat-subscription-billing";

export async function fetchUcatSubscriptionBilling(): Promise<UcatSubscriptionBillingResponse> {
  return fetchBilling();
}
