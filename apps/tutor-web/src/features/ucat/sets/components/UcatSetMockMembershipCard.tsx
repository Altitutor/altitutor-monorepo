'use client'

import { useMemo } from 'react'
import { useUcatMocks } from '@/features/ucat/mocks/hooks/useUcatMocks'
import { UcatBlueprintCompliancePanel } from '@/features/ucat/mocks/components/UcatBlueprintCompliancePanel'
import type { LinkedMockBlueprintCompliance } from '@/features/ucat/mocks/lib/blueprint-compliance'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { parseJsonUuidArray } from '@/features/ucat/shared/lib/parse-json-uuid-array'

type LinkedMock = {
  id: string
  name: string
  compliance: LinkedMockBlueprintCompliance['compliance'] | null
}

export function UcatSetMockMembershipCard({
  setId,
  linkedBlueprintReports = [],
  onViewMock,
}: {
  setId: string | null | undefined
  linkedBlueprintReports?: LinkedMockBlueprintCompliance[]
  onViewMock?: (mockId: string) => void
}) {
  const setsQuery = useUcatSets()
  const mocksQuery = useUcatMocks()

  const linkedMocks = useMemo((): LinkedMock[] => {
    if (!setId) return []
    const setRow = (setsQuery.data ?? []).find((set) => set.id === setId)
    const mockIds = parseJsonUuidArray(setRow?.ucat_mock_ids)
    const complianceByMockId = new Map(
      linkedBlueprintReports.map((report) => [report.mockId, report.compliance] as const),
    )
    const nameByMockId = new Map(
      (mocksQuery.data ?? []).flatMap((mock) =>
        mock.id
          ? [[mock.id, (mock.name ?? '').trim() || 'Untitled'] as const]
          : [],
      ),
    )
    for (const report of linkedBlueprintReports) {
      if (!nameByMockId.has(report.mockId)) nameByMockId.set(report.mockId, report.mockName)
    }

    const ids = mockIds.length > 0
      ? mockIds
      : linkedBlueprintReports.map((report) => report.mockId)

    return Array.from(new Set(ids))
      .map((id) => ({
        id,
        name: nameByMockId.get(id) ?? 'Untitled',
        compliance: complianceByMockId.get(id) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [setId, setsQuery.data, mocksQuery.data, linkedBlueprintReports])

  if (!setId) return null

  const isLoading = setsQuery.isLoading || mocksQuery.isLoading

  if (isLoading) {
    return <p className="text-xs text-muted-foreground">Loading mock membership...</p>
  }

  if (linkedMocks.length === 0) {
    return <p className="text-xs text-muted-foreground">Not in any mock.</p>
  }

  return (
    <ul className="space-y-2">
      {linkedMocks.map((mock) => (
        <li key={mock.id} className="space-y-1">
          {onViewMock ? (
            <button
              type="button"
              className="w-full truncate rounded px-2 py-1.5 text-left text-sm font-medium hover:bg-muted/60"
              onClick={() => onViewMock(mock.id)}
            >
              {mock.name}
            </button>
          ) : (
            <p className="truncate px-2 py-1.5 text-sm font-medium">{mock.name}</p>
          )}
          {mock.compliance ? (
            <UcatBlueprintCompliancePanel compliance={mock.compliance} />
          ) : null}
        </li>
      ))}
    </ul>
  )
}
