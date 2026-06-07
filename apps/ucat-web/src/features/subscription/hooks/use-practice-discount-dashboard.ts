"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/features/auth";
import { fetchPracticeDiscountProgress } from "@/features/subscription/api/fetch-practice-discount-progress";

export function usePracticeDiscountDashboard() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["ucat-practice-discount-dashboard", user?.id],
    queryFn: async () => {
      const data = await fetchPracticeDiscountProgress();
      if (!data) {
        throw new Error("Failed to load practice discount status");
      }
      return data;
    },
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}
