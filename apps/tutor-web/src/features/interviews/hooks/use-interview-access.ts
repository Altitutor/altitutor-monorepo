"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/shared/lib/supabase/auth";

export function useInterviewAccess() {
  const { user, loading } = useAuthStore();
  return useQuery({
    queryKey: ["interviews", "access", user?.id],
    enabled: !loading && !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch("/api/interviews/access");
      if (!response.ok) throw new Error("Unable to check interview access.");
      const result: { hasAccess: boolean } = await response.json();
      return result.hasAccess;
    },
  });
}
