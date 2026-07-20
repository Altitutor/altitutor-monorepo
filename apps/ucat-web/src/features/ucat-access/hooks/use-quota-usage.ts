"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { fetchQuotaUsage } from "@/features/ucat-access/api/fetch-quota-usage";

/**
 * UCAT Free quota usage per area for the current student.
 */
export function useQuotaUsage() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ucat-quota-usage", user?.id],
    queryFn: fetchQuotaUsage,
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}
