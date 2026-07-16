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
 * Lightweight server-aggregated daily activity for review calendars. Returns at
 * most ~365 small rows instead of every question/set attempt.
 */
export function useUcatActivity(enabled = true) {
  return useQuery({
    queryKey: ["ucat", "activity"],
    queryFn: fetchActivity,
    staleTime: 5 * 60 * 1000,
    enabled,
  });
}
