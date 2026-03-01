import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatClassesApi } from '@/features/ucat/classes/api/classes'

export function useUcatClassSessions(classId: string | null) {
  return useQuery({
    queryKey: classId ? ucatKeys.classSessions(classId) : [...ucatKeys.classes(), 'sessions', 'empty'],
    queryFn: () => ucatClassesApi.sessionsForClass(classId as string),
    enabled: !!classId,
  })
}

export function useAssignSetToSessions() {
  const queryClient = useQueryClient()
  return {
    mutateAsync: async (params: { setId: string; sessionIds: string[] }) => {
      const res = await fetch(`/api/ucat/question-sets/${params.setId}/sessions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: params.sessionIds }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to assign set to sessions')
      }
      queryClient.invalidateQueries({ queryKey: ucatKeys.classes() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.students() })
    },
  }
}

export function useAssignMockToSessions() {
  const queryClient = useQueryClient()
  return {
    mutateAsync: async (params: { mockId: string; sessionIds: string[] }) => {
      const res = await fetch(`/api/ucat/mocks/${params.mockId}/sessions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionIds: params.sessionIds }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to assign mock to sessions')
      }
      queryClient.invalidateQueries({ queryKey: ucatKeys.classes() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() })
      queryClient.invalidateQueries({ queryKey: ucatKeys.students() })
    },
  }
}
