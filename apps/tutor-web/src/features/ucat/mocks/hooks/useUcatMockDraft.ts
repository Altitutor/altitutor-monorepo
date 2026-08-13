import { useEffect, useMemo, useState } from 'react'
import type { RichTextJson } from '@/features/ucat/shared/types'
import { snapshotMockDraft } from '@/features/ucat/shared/lib/dirty-state'
import { useUcatMockDetail, useUpdateUcatMock } from '@/features/ucat/mocks/hooks/useUcatMocks'

type UseUcatMockDraftArgs = {
  open: boolean
  mockId: string | null
}

export function useUcatMockDraft({ open, mockId }: UseUcatMockDraftArgs) {
  const detail = useUcatMockDetail(open ? mockId : null)
  const updateMock = useUpdateUcatMock()

  const [name, setName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [draftSetIds, setDraftSetIds] = useState<string[]>([])
  const [blueprintId, setBlueprintId] = useState<string | null>(null)
  const [instructionsText, setInstructionsText] = useState<RichTextJson | null>(null)
  const [baseline, setBaseline] = useState('')

  useEffect(() => {
    const current = detail.data as { name?: string; access_scope?: 'public' | 'private'; sets?: Array<{ id: string }>; instructions_text?: unknown; blueprint_id?: string | null } | null
    if (!current) return
    const setIds = ((current.sets ?? []) as Array<{ id: string }>).map((set) => set.id)
    setName(current.name ?? '')
    setIsPrivate(current.access_scope === 'private')
    setDraftSetIds(setIds)
    setBlueprintId(current.blueprint_id ?? null)
    setInstructionsText((current.instructions_text ?? null) as RichTextJson | null)
    setBaseline(
      snapshotMockDraft({
        name: current.name ?? '',
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
        name,
        accessScope: isPrivate ? 'private' : 'public',
        setIds: draftSetIds,
        instructionsText,
        blueprintId,
      },
    })
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
