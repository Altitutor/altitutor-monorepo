import { useQuery } from '@tanstack/react-query'
import type { ProgressResponse } from '@altitutor/shared'

async function fetchProgress(studentId: string): Promise<ProgressResponse> {
  const res = await fetch(`/api/ucat/students/${studentId}/progress`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to fetch progress')
  }
  return res.json()
}

export function useProgress(studentId: string | null) {
  return useQuery({
    queryKey: ['ucat', 'students', studentId, 'progress'],
    queryFn: () => fetchProgress(studentId!),
    enabled: !!studentId,
  })
}
