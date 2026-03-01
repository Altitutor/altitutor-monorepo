'use client'

import { useQuery } from '@tanstack/react-query'
import { getStudentMocks } from '@/features/mocks/api/mocks-api'

export function useMocks() {
  return useQuery({
    queryKey: ['ucat', 'student-mocks'],
    queryFn: getStudentMocks,
  })
}
