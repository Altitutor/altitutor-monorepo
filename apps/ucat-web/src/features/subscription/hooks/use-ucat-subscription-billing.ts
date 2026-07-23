import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { fetchUcatSubscriptionBilling } from "@/features/subscription/api/fetch-ucat-subscription-billing";

export const UCAT_SUBSCRIPTION_BILLING_QUERY_KEY = [
  "ucat",
  "subscription-billing",
] as const;

export function useUcatSubscriptionBilling(enabled = true) {
  const { user } = useAuth();

  return useQuery({
    queryKey: [...UCAT_SUBSCRIPTION_BILLING_QUERY_KEY, user?.id ?? "anonymous"],
    queryFn: fetchUcatSubscriptionBilling,
    enabled: enabled && Boolean(user),
    staleTime: 60_000,
  });
}
