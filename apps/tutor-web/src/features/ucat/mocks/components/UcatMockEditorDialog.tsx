'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatMockDetail, useUpdateUcatMock } from '@/features/ucat/mocks/hooks/useUcatMocks'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatSortableList } from '@/features/ucat/shared/drag-list'
import { formatSecondsToDuration } from '@/features/ucat/shared/lib/time-utils'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

type SetOption = {
  id: string
  name: string
  sectionDisplay: string
  question_count: number | null
  time_limit_seconds: number | null
}

function formatSectionsDisplay(sections: unknown): string {
  if (!Array.isArray(sections)) return ''
  return sections
    .map((s: { section_number?: number; name?: string }) => {
      if (s?.section_number != null && s?.name != null) return `Section ${s.section_number}: ${s.name}`
      if (s?.name) return String(s.name)
      return ''
    })
    .filter(Boolean)
    .join(' · ')
}

export function UcatMockEditorDialog({
  open,
  mockId,
  onClose,
  onEditSet,
}: {
  open: boolean
  mockId: string | null
  onClose: () => void
  onEditSet?: (setId: string) => void
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
    return (sets.data ?? []).map((set) => ({
      id: set.id ?? '',
      name: proseMirrorToPlainText(set.name ?? null) || 'Untitled',
      sectionDisplay: formatSectionsDisplay(set.sections ?? null),
      question_count: set.question_count ?? null,
      time_limit_seconds: set.time_limit_seconds ?? null,
    }))
  }, [sets.data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return setCatalog.filter(
      (set) => !draftSetIds.includes(set.id) && (q === '' || set.name.toLowerCase().includes(q) || set.sectionDisplay.toLowerCase().includes(q))
    )
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
      <div className="h-full flex">
        <section className="flex-1 min-w-0 overflow-y-auto border-r p-6 space-y-3">
          <h2 className="font-semibold">Sets in Mock</h2>

          <UcatSortableList
            ids={draftSetIds}
            onChange={setDraftSetIds}
            onRemove={(id) => setDraftSetIds((prev) => prev.filter((setId) => setId !== id))}
            renderLabel={(id, index) => {
              const set = setCatalog.find((item) => item.id === id)
              if (!set) return <><span className="font-medium">{index + 1}.</span> {id.slice(0, 8)}</>
              return (
                <div className="flex w-full items-start justify-between gap-6">
                  <div className="min-w-0">
                    <div>
                      <span className="font-medium">{index + 1}.</span> {set.name}
                    </div>
                    {set.sectionDisplay ? (
                      <div className="text-xs text-muted-foreground">{set.sectionDisplay}</div>
                    ) : null}
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-x-6 text-right text-sm text-muted-foreground">
                    <div>{set.question_count != null ? `${set.question_count} Q` : '—'}</div>
                    <div>{formatSecondsToDuration(set.time_limit_seconds)}</div>
                  </div>
                </div>
              )
            }}
          />

          <div className="pt-2">
            <h3 className="mb-2 text-sm font-medium">Add Set</h3>
            <Input placeholder="Search sets" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
            <div className="max-h-52 space-y-1 overflow-auto">
              {filtered.slice(0, 30).map((set) => (
                <div
                  key={set.id}
                  className="flex w-full items-start justify-between gap-4 rounded border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{set.name}</div>
                    {set.sectionDisplay ? (
                      <div className="text-xs text-muted-foreground">{set.sectionDisplay}</div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="grid grid-cols-2 gap-x-4 text-right text-sm text-muted-foreground">
                      <div>{set.question_count != null ? `${set.question_count} Q` : '—'}</div>
                      <div>{formatSecondsToDuration(set.time_limit_seconds)}</div>
                    </div>
                    {onEditSet ? (
                      <Button variant="outline" size="sm" onClick={() => onEditSet(set.id)}>
                        Edit
                      </Button>
                    ) : null}
                    <Button size="sm" onClick={() => setDraftSetIds((prev) => [...prev, set.id])}>
                      Add set
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="w-80 flex-shrink-0 overflow-y-auto border-l p-6 space-y-3">
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
