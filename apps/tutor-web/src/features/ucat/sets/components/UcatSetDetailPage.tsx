'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@altitutor/ui'
import { useUcatSetDetail, useUpdateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { isSnapshotDirty, snapshotSetDetail } from '@/features/ucat/shared/lib/dirty-state'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { getSupabaseClient } from '@/shared/lib/supabase/client'
import type { Database, Json } from '@altitutor/shared'
import type { SupabaseClient } from '@supabase/supabase-js'

type StemCatalogItem = {
  id: string
  label: string
}

type SetDetailStem = {
  stem_id: string
  stem_text: unknown
  questions_meta?: Array<{ id: string; index: number }>
}

export function UcatSetDetailPage({ setId }: { setId: string }) {
  const access = useUcatAccess()
  const detail = useUcatSetDetail(setId)
  const updateSet = useUpdateUcatSet()

  const [stemCatalog, setStemCatalog] = useState<StemCatalogItem[]>([])
  const [search, setSearch] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftTimeLimit, setDraftTimeLimit] = useState('')
  const [draftPrivate, setDraftPrivate] = useState(false)
  const [draftStudentGenerated, setDraftStudentGenerated] = useState(false)
  const [draftStemIds, setDraftStemIds] = useState<string[]>([])
  const [baseline, setBaseline] = useState<string>('')

  useEffect(() => {
    const current = detail.data
    if (!current) return

    const stems = (current.stems as SetDetailStem[] | null) ?? []
    const stemIds = stems.map((s) => s.stem_id)

    setDraftDescription(proseMirrorToPlainText(current.description))
    setDraftTimeLimit(current.time_limit_seconds ? String(current.time_limit_seconds) : '')
    setDraftPrivate(!!current.is_private)
    setDraftStudentGenerated(!!current.is_student_generated)
    setDraftStemIds(stemIds)
    setBaseline(snapshotSetDetail({
      description: proseMirrorToPlainText(current.description),
      time: current.time_limit_seconds ?? null,
      isPrivate: !!current.is_private,
      isStudentGenerated: !!current.is_student_generated,
      stemIds,
    }))
  }, [detail.data])

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>
      const { data } = await supabase.from('vtutor_ucat_question_stems').select('id,section_name,category_name,stem_text')
      const items: StemCatalogItem[] = (data ?? [])
        .filter((row): row is { id: string; section_name: string | null; category_name: string | null; stem_text: Json } => row.id != null)
        .map((row) => ({
          id: row.id,
          label: [row.section_name, row.category_name].filter(Boolean).join(' · ') + ' — ' + (proseMirrorToPlainText(row.stem_text) || row.id.slice(0, 8)),
        }))
      setStemCatalog(items)
    }
    void run()
  }, [])

  const isDirty = useMemo(() => {
    const snapshot = snapshotSetDetail({
      description: draftDescription,
      time: draftTimeLimit ? Number(draftTimeLimit) : null,
      isPrivate: draftPrivate,
      isStudentGenerated: draftStudentGenerated,
      stemIds: draftStemIds,
    })
    return isSnapshotDirty(snapshot, baseline)
  }, [baseline, draftDescription, draftPrivate, draftStemIds, draftStudentGenerated, draftTimeLimit])

  const stemLabelsById = useMemo(() => {
    const current = detail.data
    const stems = (current?.stems as SetDetailStem[] | null) ?? []
    const map = new Map<string, string>()
    stems.forEach((s) => {
      const snippet = proseMirrorToPlainText(s.stem_text as Json) || s.stem_id.slice(0, 8)
      const qCount = (s.questions_meta ?? []).length
      map.set(s.stem_id, `${snippet.slice(0, 60)}${snippet.length > 60 ? '…' : ''} (${qCount} Q${qCount === 1 ? '' : 's'})`)
    })
    stemCatalog.forEach((item) => {
      if (!map.has(item.id)) map.set(item.id, item.label)
    })
    return map
  }, [detail.data, stemCatalog])

  const filteredCatalog = useMemo(() => {
    return stemCatalog.filter((stem) => {
      if (draftStemIds.includes(stem.id)) return false
      if (search.trim().length === 0) return true
      return stem.label.toLowerCase().includes(search.toLowerCase())
    })
  }, [stemCatalog, draftStemIds, search])

  async function save() {
    await updateSet.mutateAsync({
      setId,
      payload: {
        id: setId,
        description: draftDescription,
        timeLimitSeconds: draftTimeLimit ? Number(draftTimeLimit) : null,
        isPrivate: draftPrivate,
        isStudentGenerated: draftStudentGenerated,
        stemIds: draftStemIds,
      },
    })
  }

  function reset() {
    const current = detail.data
    if (!current) return
    const stems = (current.stems as SetDetailStem[] | null) ?? []
    setDraftStemIds(stems.map((s) => s.stem_id))
    setDraftDescription(proseMirrorToPlainText(current.description))
    setDraftTimeLimit(current.time_limit_seconds ? String(current.time_limit_seconds) : '')
    setDraftPrivate(!!current.is_private)
    setDraftStudentGenerated(!!current.is_student_generated)
  }

  if (access.isLoading || detail.isLoading) return <UcatPageSkeleton rows={6} />

  if (!access.data) return <UcatAccessDenied />
  if (!detail.data) return <div className="p-6">Set not found.</div>

  return (
    <div className="p-6">
      <UcatPageHeader
        title="Set Detail"
        backHref="/ucat/sets"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Sets', href: '/ucat/sets' }, { label: 'Detail' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={reset} disabled={!isDirty}>Cancel</Button>
            <Button onClick={save} disabled={!isDirty || updateSet.isPending}>{updateSet.isPending ? 'Saving...' : 'Save'}</Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <section className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">Stems in Set</h2>
          {draftStemIds.map((stemId, index) => (
            <div key={stemId} className="rounded border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm"><span className="font-medium">{index + 1}.</span> {stemLabelsById.get(stemId) ?? stemId.slice(0, 8)}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (index === 0) return
                      setDraftStemIds((prev) => {
                        const next = [...prev]
                        ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
                        return next
                      })
                    }}
                  >
                    Up
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (index === draftStemIds.length - 1) return
                      setDraftStemIds((prev) => {
                        const next = [...prev]
                        ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
                        return next
                      })
                    }}
                  >
                    Down
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDraftStemIds((prev) => prev.filter((id) => id !== stemId))}>
                    Remove
                  </Button>
                </div>
              </div>
            </div>
          ))}

          <div className="rounded border border-dashed p-3">
            <h3 className="mb-2 text-sm font-medium">Add Stem</h3>
            <input className="mb-2 w-full rounded border p-2" placeholder="Search stems" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-52 space-y-1 overflow-auto">
              {filteredCatalog.slice(0, 40).map((stem) => (
                <button
                  key={stem.id}
                  type="button"
                  className="block w-full rounded border px-2 py-1 text-left text-sm hover:bg-muted"
                  onClick={() => setDraftStemIds((prev) => [...prev, stem.id])}
                >
                  {stem.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">Set Properties</h2>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Description</span>
            <textarea className="min-h-24 w-full rounded border p-2" value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Time limit (seconds)</span>
            <input className="w-full rounded border p-2" type="number" value={draftTimeLimit} onChange={(e) => setDraftTimeLimit(e.target.value)} />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draftPrivate} onChange={(e) => setDraftPrivate(e.target.checked)} />
            Private
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={draftStudentGenerated} onChange={(e) => setDraftStudentGenerated(e.target.checked)} />
            Student generated
          </label>
        </aside>
      </div>
    </div>
  )
}
