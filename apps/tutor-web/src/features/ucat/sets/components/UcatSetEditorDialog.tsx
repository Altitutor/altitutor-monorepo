'use client'

import { useEffect, useMemo, useState } from 'react'
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@altitutor/ui'
import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'
import { useUcatSetDetail, useUpdateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { isSnapshotDirty, snapshotSetDetail } from '@/features/ucat/shared/lib/dirty-state'
import { parseTimeToSeconds, secondsToTimeString } from '@/features/ucat/shared/lib/time-utils'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatSortableList } from '@/features/ucat/shared/drag-list'

type StemCatalogItem = { id: string; text: string }

/** Shape of each stem in vtutor_ucat_question_set_detail.stems (from DB view) */
type SetDetailStem = { stem_id: string; stem_text?: unknown; questions_meta?: Array<{ id: string; index: number }> }

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
  const [draftStemIds, setDraftStemIds] = useState<string[]>([])
  const [baseline, setBaseline] = useState<string>('')

  useEffect(() => {
    const current = detail.data
    if (!current) return

    const stems = (current.stems as SetDetailStem[] | null) ?? []
    const stemIds = stems.map((s) => s.stem_id)

    setDraftName(proseMirrorToPlainText(current.name ?? null))
    setDraftDescription(proseMirrorToPlainText(current.description))
    setDraftTimeLimit(secondsToTimeString(current.time_limit_seconds))
    setDraftPrivate(!!current.is_private)
    setDraftStemIds(stemIds)
    setBaseline(
      snapshotSetDetail({
        name: proseMirrorToPlainText(current.name ?? null),
        description: proseMirrorToPlainText(current.description),
        time: current.time_limit_seconds ?? null,
        isPrivate: !!current.is_private,
        isStudentGenerated: false,
        stemIds,
      })
    )
  }, [detail.data])

  useEffect(() => {
    if (!open) return

    const run = async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>
      const { data } = await supabase.from('vtutor_ucat_question_stems').select('id,stem_text')
      const items: StemCatalogItem[] = (data ?? []).map((row) => ({
        id: row.id ?? '',
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
      time: parseTimeToSeconds(draftTimeLimit),
      isPrivate: draftPrivate,
      isStudentGenerated: false,
      stemIds: draftStemIds,
    })
    return isSnapshotDirty(snapshot, baseline)
  }, [baseline, draftName, draftDescription, draftPrivate, draftStemIds, draftTimeLimit])

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
        timeLimitSeconds: parseTimeToSeconds(draftTimeLimit),
        isPrivate: draftPrivate,
        isStudentGenerated: false,
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
      <div className="h-full flex">
        <section className="flex-1 min-w-0 overflow-y-auto border-r p-6 space-y-3">
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

          <div className="pt-2">
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

        <aside className="w-80 flex-shrink-0 overflow-y-auto border-l p-6 space-y-3">
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
            <span className="mb-1 block font-medium">Time limit (mm:ss or seconds)</span>
            <Input type="text" value={draftTimeLimit} onChange={(e) => setDraftTimeLimit(e.target.value)} placeholder="e.g. 1:30 or 90" />
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
        </aside>
      </div>
    </UcatDialogShell>
  )
}
