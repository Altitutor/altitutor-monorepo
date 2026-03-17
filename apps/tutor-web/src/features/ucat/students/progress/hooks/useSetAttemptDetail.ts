import { useQuery } from '@tanstack/react-query'
import type { SetAttemptDetailResponse } from '@/app/api/ucat/students/[studentId]/progress/sets/[attemptId]/route'

async function fetchSetAttemptDetail(
  studentId: string,
  attemptId: string
): Promise<SetAttemptDetailResponse> {
  const res = await fetch(
    `/api/ucat/students/${studentId}/progress/sets/${attemptId}`
  )
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to fetch set attempt')
  }
  return res.json()
}

export function useSetAttemptDetail(
  studentId: string | null,
  attemptId: string | null
) {
  return useQuery({
    queryKey: ['ucat', 'students', studentId, 'progress', 'set-attempt', attemptId],
    queryFn: () => fetchSetAttemptDetail(studentId!, attemptId!),
    enabled: !!studentId && !!attemptId,
  })
}
