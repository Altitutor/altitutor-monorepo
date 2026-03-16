'use client'

import { useQuery } from '@tanstack/react-query'
import { getAttemptedSetIds, getSetAttempts, getStudentSets } from '@/features/sets/api/sets-api'

export function useSets() {
  return useQuery({
    queryKey: ['ucat', 'student-sets'],
    queryFn: getStudentSets,
  })
}

export function useAttemptedSetIds() {
  return useQuery({
    queryKey: ['ucat', 'attempted-set-ids'],
    queryFn: getAttemptedSetIds,
  })
}

export function useSetAttempts(setId: string | null) {
  return useQuery({
    queryKey: ['ucat', 'set-attempts', setId],
    queryFn: () => (setId ? getSetAttempts(setId) : Promise.resolve([])),
    enabled: !!setId,
  })
}
