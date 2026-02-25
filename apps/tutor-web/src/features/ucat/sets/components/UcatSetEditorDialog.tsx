'use client'

import { useEffect, useMemo, useState } from 'react'
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@altitutor/ui'
import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useUcatSetDetail, useUpdateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { isSnapshotDirty, snapshotSetDetail } from '@/features/ucat/shared/lib/dirty-state'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatSortableList } from '@/features/ucat/shared/drag-list'

type StemCatalogItem = { id: string; text: string }

export function UcatSetEditorDialog({
  open,
  setId,
  onClose,
}: {
  open: boolean
  setId: string | null
  onClose: () => void
}) {
  const detail = useUcatSetDetail(open ? setId : null)
  const updateSet = useUpdateUcatSet()

  const [stemCatalog, setStemCatalog] = useState<StemCatalogItem[]>([])
  const [search, setSearch] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftTimeLimit, setDraftTimeLimit] = useState('')
  const [draftPrivate, setDraftPrivate] = useState(false)
  const [draftStudentGenerated, setDraftStudentGenerated] = useState(false)
  const [draftStemIds, setDraftStemIds] = useState<string[]>([])
  const [baseline, setBaseline] = useState<string>('')

  useEffect(() => {
    const current = detail.data
    if (!current) return

    const stems = (current.stems as Array<{ id: string }> | null) ?? []
    const stemIds = stems.map((stem) => stem.id)

    setDraftName(proseMirrorToPlainText(current.name ?? null))
    setDraftDescription(proseMirrorToPlainText(current.description))
    setDraftTimeLimit(current.time_limit_seconds ? String(current.time_limit_seconds) : '')
    setDraftPrivate(!!current.is_private)
    setDraftStudentGenerated(!!current.is_student_generated)
    setDraftStemIds(stemIds)
    setBaseline(
      snapshotSetDetail({
        name: proseMirrorToPlainText(current.name ?? null),
        description: proseMirrorToPlainText(current.description),
        time: current.time_limit_seconds ?? null,
        isPrivate: !!current.is_private,
        isStudentGenerated: !!current.is_student_generated,
        stemIds,
      })
    )
  }, [detail.data])

  useEffect(() => {
    if (!open) return

    const run = async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>
      const { data } = await supabase.from('vtutor_ucat_question_stems').select('id,stem_text')
      const items: StemCatalogItem[] = (data ?? []).map((row: any) => ({
        id: row.id,
        text: proseMirrorToPlainText(row.stem_text),
      }))
      setStemCatalog(items)
    }

    void run()
  }, [open])

  const isDirty = useMemo(() => {
    const snapshot = snapshotSetDetail({
      name: draftName,
      description: draftDescription,
      time: draftTimeLimit ? Number(draftTimeLimit) : null,
      isPrivate: draftPrivate,
      isStudentGenerated: draftStudentGenerated,
      stemIds: draftStemIds,
    })
    return isSnapshotDirty(snapshot, baseline)
  }, [baseline, draftName, draftDescription, draftPrivate, draftStemIds, draftStudentGenerated, draftTimeLimit])

  const filteredCatalog = useMemo(() => {
    return stemCatalog.filter((stem) => {
      if (draftStemIds.includes(stem.id)) return false
      if (search.trim().length === 0) return true
      return stem.text.toLowerCase().includes(search.toLowerCase())
    })
  }, [stemCatalog, draftStemIds, search])

  async function save() {
    if (!setId) return
    await updateSet.mutateAsync({
      setId,
      payload: {
        id: setId,
        name: plainTextToProseMirror(draftName),
        description: draftDescription,
        timeLimitSeconds: draftTimeLimit ? Number(draftTimeLimit) : null,
        isPrivate: draftPrivate,
        isStudentGenerated: draftStudentGenerated,
        stemIds: draftStemIds,
      },
    })
    onClose()
  }

  return (
    <UcatDialogShell
      open={open}
      onClose={onClose}
      title="Edit Set"
      subtitle="Reorder stems and update set properties"
      onSave={save}
      saveDisabled={!isDirty || updateSet.isPending}
      isSaving={updateSet.isPending}
    >
      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <section className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">Stems in Set</h2>

          <UcatSortableList
            ids={draftStemIds}
            onChange={setDraftStemIds}
            onRemove={(id) => setDraftStemIds((prev) => prev.filter((stemId) => stemId !== id))}
            renderLabel={(id, index) => {
              const stem = stemCatalog.find((item) => item.id === id)
              return (
                <>
                  <span className="font-medium">{index + 1}.</span> {stem?.text || id}
                </>
              )
            }}
          />

          <div className="rounded border border-dashed p-3">
            <h3 className="mb-2 text-sm font-medium">Add Stem</h3>
            <Input placeholder="Search stems" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
            <div className="max-h-52 space-y-1 overflow-auto">
              {filteredCatalog.slice(0, 40).map((stem) => (
                <button
                  key={stem.id}
                  type="button"
                  className="block w-full rounded border px-2 py-1 text-left text-sm hover:bg-muted"
                  onClick={() => setDraftStemIds((prev) => [...prev, stem.id])}
                >
                  {stem.text || stem.id}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">Set Properties</h2>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Name</span>
            <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} placeholder="Set name" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Description</span>
            <Textarea className="min-h-24" value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Time limit (seconds)</span>
            <Input type="number" value={draftTimeLimit} onChange={(e) => setDraftTimeLimit(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Visibility</span>
            <Select value={draftPrivate ? 'private' : 'public'} onValueChange={(v) => setDraftPrivate(v === 'private')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Public</SelectItem>
                <SelectItem value="private">Private</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Origin</span>
            <Select value={draftStudentGenerated ? 'student' : 'staff'} onValueChange={(v) => setDraftStudentGenerated(v === 'student')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">Staff</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </aside>
      </div>
    </UcatDialogShell>
  )
}
