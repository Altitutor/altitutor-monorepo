import { useEffect, useMemo, useState } from 'react'
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
  const [baseline, setBaseline] = useState('')

  useEffect(() => {
    const current = detail.data
    if (!current) return
    const setIds = ((current.sets as Array<{ id: string }> | null) ?? []).map((set) => set.id)
    setName(current.name ?? '')
    setIsPrivate(!!current.is_private)
    setDraftSetIds(setIds)
    setBaseline(JSON.stringify({ name: current.name ?? '', isPrivate: !!current.is_private, setIds }))
  }, [detail.data])

  const isDirty = useMemo(() => {
    return JSON.stringify({ name, isPrivate, setIds: draftSetIds }) !== baseline
  }, [baseline, draftSetIds, isPrivate, name])

  const save = async () => {
    if (!mockId || !isDirty) return
    await updateMock.mutateAsync({ mockId, payload: { id: mockId, name, isPrivate, setIds: draftSetIds } })
  }

  return {
    detail,
    name,
    isPrivate,
    draftSetIds,
    setName,
    setIsPrivate,
    setDraftSetIds,
    isDirty,
    save,
    isSaving: updateMock.isPending,
  }
}

