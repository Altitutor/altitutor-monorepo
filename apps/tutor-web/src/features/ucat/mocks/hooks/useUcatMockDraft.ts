import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { RichTextJson } from '@/features/ucat/shared/types'
import { snapshotMockDraft } from '@/features/ucat/shared/lib/dirty-state'
import { useUcatMockDetail, useUpdateUcatMock } from '@/features/ucat/mocks/hooks/useUcatMocks'
import { ucatMocksApi } from '@/features/ucat/mocks/api/mocks'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'

type UseUcatMockDraftArgs = {
  open: boolean
  mockId: string | null
}

export function useUcatMockDraft({ open, mockId }: UseUcatMockDraftArgs) {
  const detail = useUcatMockDetail(open ? mockId : null)
  const updateMock = useUpdateUcatMock()
  const queryClient = useQueryClient()

  const [name, setName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [draftSetIds, setDraftSetIds] = useState<string[]>([])
  const [baselineSetIds, setBaselineSetIds] = useState<string[]>([])
  const [blueprintId, setBlueprintId] = useState<string | null>(null)
  const [instructionsText, setInstructionsText] = useState<RichTextJson | null>(null)
  const [baseline, setBaseline] = useState('')

  useEffect(() => {
    const current = detail.data as { authoring_note?: string | null; access_scope?: 'public' | 'private'; sets?: Array<{ id: string }>; instructions_text?: unknown; blueprint_id?: string | null } | null
    if (!current) return
    const setIds = ((current.sets ?? []) as Array<{ id: string }>).map((set) => set.id)
    setName(current.authoring_note ?? '')
    setIsPrivate(current.access_scope === 'private')
    setDraftSetIds(setIds)
    setBaselineSetIds(setIds)
    setBlueprintId(current.blueprint_id ?? null)
    setInstructionsText((current.instructions_text ?? null) as RichTextJson | null)
    setBaseline(
      snapshotMockDraft({
        name: current.authoring_note ?? '',
        accessScope: current.access_scope ?? 'public',
        setIds,
        instructionsText: (current.instructions_text ?? null) as RichTextJson | null,
        blueprintId: current.blueprint_id ?? null,
      })
    )
  }, [detail.data])

  const isDirty = useMemo(() => {
    return (
      baseline !== '' &&
      snapshotMockDraft({
        name,
        accessScope: isPrivate ? 'private' : 'public',
        setIds: draftSetIds,
        instructionsText,
        blueprintId,
      }) !== baseline
    )
  }, [baseline, blueprintId, draftSetIds, instructionsText, isPrivate, name])

  const save = async () => {
    if (!mockId || !isDirty) return
    await updateMock.mutateAsync({
      mockId,
      payload: {
        id: mockId,
        authoringNote: name,
        accessScope: isPrivate ? 'private' : 'public',
        instructionsText,
        blueprintId: blueprintId ?? '',
      },
    })
    const currentIds = new Set(draftSetIds)
    const originalIds = new Set(baselineSetIds)
    for (const setId of baselineSetIds) {
      if (!currentIds.has(setId)) await ucatMocksApi.detachSet(mockId, setId)
    }
    for (const setId of draftSetIds) {
      if (!originalIds.has(setId)) await ucatMocksApi.attachSet(mockId, setId)
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ucatKeys.mocks() }),
      queryClient.invalidateQueries({ queryKey: ucatKeys.sets() }),
    ])
  }

  return {
    detail,
    name,
    isPrivate,
    instructionsText,
    setInstructionsText,
    draftSetIds,
    blueprintId,
    setName,
    setIsPrivate,
    setDraftSetIds,
    setBlueprintId,
    isDirty,
    save,
    isSaving: updateMock.isPending,
  }
}
