import { useQuery } from "@tanstack/react-query";
import type { PracticeAttemptDetailResponse } from "@/app/api/ucat/progress/practice-sessions/[id]/route";

export async function fetchPracticeAttemptDetail(
  attemptId: string,
): Promise<PracticeAttemptDetailResponse> {
  const res = await fetch(`/api/ucat/progress/practice-sessions/${attemptId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to fetch practice attempt");
  }
  return res.json();
}

export const practiceAttemptDetailQueryKey = (attemptId: string | null) =>
  ["ucat", "progress", "practice-attempt", attemptId] as const;

export function usePracticeAttemptDetail(attemptId: string | null) {
  return useQuery({
    queryKey: practiceAttemptDetailQueryKey(attemptId),
    queryFn: () => fetchPracticeAttemptDetail(attemptId!),
    enabled: !!attemptId,
    staleTime: 30_000,
  });
}
