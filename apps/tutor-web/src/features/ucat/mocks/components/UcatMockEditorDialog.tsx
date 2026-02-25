'use client'

import { useEffect, useMemo, useState } from 'react'
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatMockDetail, useUpdateUcatMock } from '@/features/ucat/mocks/hooks/useUcatMocks'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatSortableList } from '@/features/ucat/shared/drag-list'

type SetOption = { id: string; label: string }

export function UcatMockEditorDialog({
  open,
  mockId,
  onClose,
}: {
  open: boolean
  mockId: string | null
  onClose: () => void
}) {
  const detail = useUcatMockDetail(open ? mockId : null)
  const sets = useUcatSets()
  const updateMock = useUpdateUcatMock()

  const [name, setName] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [draftSetIds, setDraftSetIds] = useState<string[]>([])
  const [baseline, setBaseline] = useState('')
  const [search, setSearch] = useState('')

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

  const setCatalog = useMemo<SetOption[]>(() => {
    return (sets.data ?? []).map((set) => ({ id: set.id ?? '', label: JSON.stringify(set.description ?? '') }))
  }, [sets.data])

  const filtered = useMemo(() => {
    return setCatalog.filter((set) => !draftSetIds.includes(set.id) && set.label.toLowerCase().includes(search.toLowerCase()))
  }, [draftSetIds, search, setCatalog])

  async function save() {
    if (!mockId) return
    await updateMock.mutateAsync({ mockId, payload: { id: mockId, name, isPrivate, setIds: draftSetIds } })
    onClose()
  }

  return (
    <UcatDialogShell
      open={open}
      onClose={onClose}
      title="Edit Mock"
      subtitle="Reorder sets and update mock properties"
      onSave={save}
      saveDisabled={!isDirty || updateMock.isPending}
      isSaving={updateMock.isPending}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <section className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">Sets in Mock</h2>

          <UcatSortableList
            ids={draftSetIds}
            onChange={setDraftSetIds}
            onRemove={(id) => setDraftSetIds((prev) => prev.filter((setId) => setId !== id))}
            renderLabel={(id, index) => {
              const set = setCatalog.find((item) => item.id === id)
              return (
                <>
                  <span className="font-medium">{index + 1}.</span> {set?.label || id}
                </>
              )
            }}
          />

          <div className="rounded border border-dashed p-3">
            <h3 className="mb-2 text-sm font-medium">Add Set</h3>
            <Input placeholder="Search sets" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
            <div className="max-h-52 space-y-1 overflow-auto">
              {filtered.slice(0, 30).map((set) => (
                <button
                  key={set.id}
                  type="button"
                  className="block w-full rounded border px-2 py-1 text-left text-sm hover:bg-muted"
                  onClick={() => setDraftSetIds((prev) => [...prev, set.id])}
                >
                  {set.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">Mock Properties</h2>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Visibility</span>
            <Select value={isPrivate ? 'private' : 'public'} onValueChange={(v) => setIsPrivate(v === 'private')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </aside>
      </div>
    </UcatDialogShell>
  )
}
