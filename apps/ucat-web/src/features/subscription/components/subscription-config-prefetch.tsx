"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { publicSubscriptionConfigQueryOptions } from "@/features/subscription/hooks/use-public-subscription-config";

export function SubscriptionConfigPrefetch() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    void queryClient.prefetchQuery(publicSubscriptionConfigQueryOptions);
  }, [queryClient, user]);

  return null;
}
