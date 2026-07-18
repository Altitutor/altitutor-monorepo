import { useQuery } from "@tanstack/react-query";
import type { MockAttemptDetailResponse } from "@/app/api/ucat/progress/mock-attempts/[id]/route";

export async function fetchMockAttemptDetail(
  mockAttemptId: string,
): Promise<MockAttemptDetailResponse> {
  const res = await fetch(`/api/ucat/progress/mock-attempts/${mockAttemptId}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to fetch mock attempt");
  }
  return res.json();
}

export const mockAttemptDetailQueryKey = (mockAttemptId: string | null) =>
  ["ucat", "progress", "mock-attempt", mockAttemptId] as const;

export function useMockAttemptDetail(mockAttemptId: string | null) {
  return useQuery({
    queryKey: mockAttemptDetailQueryKey(mockAttemptId),
    queryFn: () => fetchMockAttemptDetail(mockAttemptId!),
    enabled: !!mockAttemptId,
    staleTime: 30_000,
  });
}
