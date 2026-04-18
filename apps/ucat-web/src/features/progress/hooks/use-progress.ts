import { useQuery } from "@tanstack/react-query";
import type { ProgressResponse } from "@/app/api/ucat/progress/route";

async function fetchProgress(): Promise<ProgressResponse> {
  const res = await fetch("/api/ucat/progress");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to fetch progress");
  }
  return res.json();
}

export function useProgress() {
  return useQuery({
    queryKey: ["ucat", "progress"],
    queryFn: fetchProgress,
  });
}
