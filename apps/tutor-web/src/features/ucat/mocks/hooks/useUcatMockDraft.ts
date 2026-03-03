import { useEffect, useMemo, useState } from 'react'
import type { RichTextJson } from '@/features/ucat/shared/types'
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
  const [instructionsText, setInstructionsText] = useState<RichTextJson | null>(null)
  const [baseline, setBaseline] = useState('')

  useEffect(() => {
    const current = detail.data as { name?: string; is_private?: boolean; sets?: Array<{ id: string }>; instructions_text?: unknown } | null
    if (!current) return
    const setIds = ((current.sets ?? []) as Array<{ id: string }>).map((set) => set.id)
    setName(current.name ?? '')
    setIsPrivate(!!current.is_private)
    setDraftSetIds(setIds)
    setInstructionsText((current.instructions_text ?? null) as RichTextJson | null)
    setBaseline(
      JSON.stringify({
        name: current.name ?? '',
        isPrivate: !!current.is_private,
        setIds,
        instructionsText: current.instructions_text ?? null,
      })
    )
  }, [detail.data])

  const isDirty = useMemo(() => {
    return (
      JSON.stringify({ name, isPrivate, setIds: draftSetIds, instructionsText }) !== baseline
    )
  }, [baseline, draftSetIds, instructionsText, isPrivate, name])

  const save = async () => {
    if (!mockId || !isDirty) return
    await updateMock.mutateAsync({
      mockId,
      payload: {
        id: mockId,
        name,
        isPrivate,
        setIds: draftSetIds,
        instructionsText,
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
    setName,
    setIsPrivate,
    setDraftSetIds,
    isDirty,
    save,
    isSaving: updateMock.isPending,
  }
}

