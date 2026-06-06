import { useQuery } from "@tanstack/react-query";
import { fetchUcatSubscriptionBilling } from "@/features/subscription/api/fetch-ucat-subscription-billing";

export const UCAT_SUBSCRIPTION_BILLING_QUERY_KEY = [
  "ucat",
  "subscription-billing",
] as const;

export function useUcatSubscriptionBilling(enabled = true) {
  return useQuery({
    queryKey: UCAT_SUBSCRIPTION_BILLING_QUERY_KEY,
    queryFn: fetchUcatSubscriptionBilling,
    enabled,
    staleTime: 60_000,
  });
}
