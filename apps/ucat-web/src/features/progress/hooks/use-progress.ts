import { useQuery } from "@tanstack/react-query";
import type { ProgressResponse } from "@/app/api/ucat/progress/route";
import type { ProgressSummaryResponse } from "@/features/progress/types/progress-summary";

async function fetchProgressSummary(): Promise<ProgressSummaryResponse> {
  const res = await fetch("/api/ucat/progress/summary");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to fetch progress summary");
  }
  return res.json();
}

async function fetchProgress(): Promise<ProgressResponse> {
  const res = await fetch("/api/ucat/progress");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to fetch progress");
  }
  return res.json();
}

async function fetchSectionProgress(
  sectionNumber: number,
): Promise<ProgressResponse> {
  const res = await fetch(
    `/api/ucat/progress?sectionNumber=${encodeURIComponent(sectionNumber)}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to fetch section progress");
  }
  return res.json();
}

export function useProgress() {
  return useQuery({
    queryKey: ["ucat", "progress"],
    queryFn: fetchProgress,
  });
}

export function useProgressSummary() {
  return useQuery({
    queryKey: ["ucat", "progress", "summary"],
    queryFn: fetchProgressSummary,
  });
}

export function useSectionProgress(sectionNumber: number) {
  return useQuery({
    queryKey: ["ucat", "progress", "section", sectionNumber],
    queryFn: () => fetchSectionProgress(sectionNumber),
  });
}
