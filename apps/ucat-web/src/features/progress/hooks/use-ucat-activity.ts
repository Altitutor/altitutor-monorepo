import { useQuery } from "@tanstack/react-query";
import type { UcatActivityResponse } from "@/app/api/ucat/activity/route";

async function fetchActivity(): Promise<UcatActivityResponse> {
  const res = await fetch("/api/ucat/activity");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to fetch activity");
  }
  return res.json();
}

/**
 * Lightweight server-aggregated daily activity for the heatmap. Returns at
 * most ~365 small rows instead of every question/set attempt.
 */
export function useUcatActivity() {
  return useQuery({
    queryKey: ["ucat", "activity"],
    queryFn: fetchActivity,
    staleTime: 5 * 60 * 1000,
  });
}
