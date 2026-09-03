'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ucatMocksApi } from '@/features/ucat/mocks/api/mocks'
import { MockSetsColumnCell } from '@/features/ucat/shared/components/MockSetsColumnCell'
import { buildMockSetsColumnRows } from '@/features/ucat/shared/lib/mock-sets-column-display'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import type { UcatSectionForStatus } from '@/features/ucat/shared/lib/set-section-status'

type MockSetsColumnCellWithDataProps = {
  mockId: string
  setCount: number
  sections: UcatSectionForStatus[]
  onOpenSet: (setId: string) => void
}

export function MockSetsColumnCellWithData({
  mockId,
  setCount,
  sections,
  onOpenSet,
}: MockSetsColumnCellWithDataProps) {
  const { data, isLoading } = useQuery({
    queryKey: ucatKeys.mock(mockId),
    queryFn: () => ucatMocksApi.detail(mockId),
    enabled: !!mockId && setCount > 0,
    staleTime: 5 * 60 * 1000,
  })

  const rows = useMemo(() => {
    if (setCount === 0) {
      return buildMockSetsColumnRows([], sections)
    }
    if (!data) return null
    const setsRaw = (data as { sets?: unknown }).sets
    const sets = Array.isArray(setsRaw)
      ? (setsRaw as Array<{
          id: string
          name?: unknown
          display_name?: string | null
          sections?: unknown
          question_count?: number | null
          time_limit_seconds?: number | null
        }>)
      : []
    return buildMockSetsColumnRows(sets, sections)
  }, [setCount, data, sections])

  return <MockSetsColumnCell rows={rows} isLoading={setCount > 0 && isLoading} onOpenSet={onOpenSet} />
}
