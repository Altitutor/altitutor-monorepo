"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { fetchPublicSubscriptionConfig } from "@/features/subscription/api/fetch-public-subscription-config";

export const PUBLIC_SUBSCRIPTION_CONFIG_QUERY_KEY = [
  "public-ucat-subscription-config",
] as const;

export const publicSubscriptionConfigQueryOptions = queryOptions({
  queryKey: PUBLIC_SUBSCRIPTION_CONFIG_QUERY_KEY,
  queryFn: fetchPublicSubscriptionConfig,
  staleTime: 5 * 60 * 1000,
  gcTime: 30 * 60 * 1000,
});

export function usePublicSubscriptionConfig() {
  return useQuery(publicSubscriptionConfigQueryOptions);
}
