import { useQuery } from '@tanstack/react-query'
import type { MockAttemptDetailResponse } from '@/app/api/ucat/progress/mocks/[id]/route'

async function fetchMockAttemptDetail(
  mockAttemptId: string
): Promise<MockAttemptDetailResponse> {
  const res = await fetch(`/api/ucat/progress/mocks/${mockAttemptId}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to fetch mock attempt')
  }
  return res.json()
}

export function useMockAttemptDetail(mockAttemptId: string | null) {
  return useQuery({
    queryKey: ['ucat', 'progress', 'mock-attempt', mockAttemptId],
    queryFn: () => fetchMockAttemptDetail(mockAttemptId!),
    enabled: !!mockAttemptId,
  })
}
