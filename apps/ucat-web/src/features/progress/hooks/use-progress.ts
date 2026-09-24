import { useQuery } from "@tanstack/react-query";
import type { ProgressSummaryResponse } from "@/features/progress/types/progress-summary";
import type { SectionProgressResponse } from "@/features/progress/types/section-progress";
import type { MockProgressResponse } from "@/features/progress/types/mock-progress";

async function fetchProgressSummary(): Promise<ProgressSummaryResponse> {
  const res = await fetch("/api/ucat/progress/summary");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to fetch progress summary");
  }
  return res.json();
}

async function fetchMockProgress(): Promise<MockProgressResponse> {
  const res = await fetch("/api/ucat/progress/mocks/summary");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to fetch progress");
  }
  return res.json();
}

async function fetchSectionProgress(sectionNumber: number): Promise<SectionProgressResponse> {
  const res = await fetch(`/api/ucat/progress/sections/${encodeURIComponent(sectionNumber)}/summary`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to fetch section progress");
  }
  return res.json();
}

export function useMockProgress() {
  return useQuery({
    queryKey: ["ucat", "progress", "mocks", "summary"],
    queryFn: fetchMockProgress,
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
