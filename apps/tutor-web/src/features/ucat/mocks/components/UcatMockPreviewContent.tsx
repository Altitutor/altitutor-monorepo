'use client'

import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { UcatStemEditorLoadingSkeleton } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorLoadingSkeleton'
import { UcatSetPreviewContent } from '@/features/ucat/sets/components/UcatSetPreviewContent'
import type { UcatPreviewNavigatorGroup } from '@/features/ucat/sets/components/UcatSetPreviewContent'
import type { SetOption } from '@/features/ucat/mocks/components/UcatMockEditorDialog'

type MockSetDetail = {
  stems?: Array<{ stem_id: string }> | null
}

export function UcatMockPreviewContent({
  setIds,
  stemCatalog,
  showAnswer,
  catalogLoading,
  setCatalog,
}: {
  setIds: string[]
  stemCatalog: UcatStemCatalogItem[]
  showAnswer: boolean
  catalogLoading: boolean
  setCatalog: SetOption[]
}) {
  const setDetailQueries = useQueries({
    queries: setIds.map((setId) => ({
      queryKey: ucatKeys.set(setId),
      queryFn: () => ucatSetsApi.detail(setId),
    })),
  })
  const isLoading = catalogLoading || setDetailQueries.some((query) => query.isLoading)
  const stemIds = useMemo(
    () => setDetailQueries.flatMap((query) => {
      const detail = query.data as MockSetDetail | undefined
      return (detail?.stems ?? []).map((stem) => stem.stem_id)
    }),
    [setDetailQueries],
  )
  const navigatorGroups = useMemo<UcatPreviewNavigatorGroup[]>(
    () => setIds.map((setId, index) => {
      const set = setCatalog.find((candidate) => candidate.id === setId)
      const detail = setDetailQueries[index]?.data as MockSetDetail | undefined
      const label = set?.sectionDisplay.replace(/^Section \d+:\s*/, '').trim()
      return {
        id: setId,
        label: label || (set?.firstSectionNumber != null ? `Section ${set.firstSectionNumber}` : set?.name ?? `Set ${index + 1}`),
        stemIds: (detail?.stems ?? []).map((stem) => stem.stem_id),
      }
    }),
    [setCatalog, setDetailQueries, setIds],
  )

  if (isLoading) return <UcatStemEditorLoadingSkeleton />

  return (
    <UcatSetPreviewContent
      stemIds={stemIds}
      stemCatalog={stemCatalog}
      showAnswer={showAnswer}
      emptyMessage="Add a set with questions to preview this mock."
      navigatorGroups={navigatorGroups}
    />
  )
}
