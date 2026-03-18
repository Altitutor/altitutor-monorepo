import { useQuery } from '@tanstack/react-query'
import type { PracticeAttemptDetailResponse } from '@/app/api/ucat/progress/practice-sessions/[id]/route'

async function fetchPracticeAttemptDetail(
  attemptId: string
): Promise<PracticeAttemptDetailResponse> {
  const res = await fetch(`/api/ucat/progress/practice-sessions/${attemptId}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to fetch practice attempt')
  }
  return res.json()
}

export function usePracticeAttemptDetail(attemptId: string | null) {
  return useQuery({
    queryKey: ['ucat', 'progress', 'practice-attempt', attemptId],
    queryFn: () => fetchPracticeAttemptDetail(attemptId!),
    enabled: !!attemptId,
  })
}
