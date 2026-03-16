import { useQuery } from '@tanstack/react-query'
import type { SetAttemptDetailResponse } from '@/app/api/ucat/progress/sets/[id]/route'

async function fetchSetAttemptDetail(
  attemptId: string
): Promise<SetAttemptDetailResponse> {
  const res = await fetch(`/api/ucat/progress/sets/${attemptId}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to fetch set attempt')
  }
  return res.json()
}

export function useSetAttemptDetail(attemptId: string | null) {
  return useQuery({
    queryKey: ['ucat', 'progress', 'set-attempt', attemptId],
    queryFn: () => fetchSetAttemptDetail(attemptId!),
    enabled: !!attemptId,
  })
}
