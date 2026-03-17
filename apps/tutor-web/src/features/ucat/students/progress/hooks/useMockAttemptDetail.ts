import { useQuery } from '@tanstack/react-query'
import type { MockAttemptDetailResponse } from '@/app/api/ucat/students/[studentId]/progress/mocks/[mockId]/route'

async function fetchMockAttemptDetail(
  studentId: string,
  mockId: string
): Promise<MockAttemptDetailResponse> {
  const res = await fetch(
    `/api/ucat/students/${studentId}/progress/mocks/${mockId}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to fetch mock attempt')
  }
  return res.json()
}

export function useMockAttemptDetail(
  studentId: string | null,
  mockId: string | null
) {
  return useQuery({
    queryKey: ['ucat', 'students', studentId, 'progress', 'mock-attempt', mockId],
    queryFn: () => fetchMockAttemptDetail(studentId!, mockId!),
    enabled: !!studentId && !!mockId,
  })
}
