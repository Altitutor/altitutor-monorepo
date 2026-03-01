'use client'

import { useQuery } from '@tanstack/react-query'
import { getStudentSets } from '@/features/sets/api/sets-api'

export function useSets() {
  return useQuery({
    queryKey: ['ucat', 'student-sets'],
    queryFn: getStudentSets,
  })
}
