'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@altitutor/ui'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatMockDetail, useUpdateUcatMock } from '@/features/ucat/mocks/hooks/useUcatMocks'

type SetOption = {
  id: string
  label: string
}

export function UcatMockDetailPage({ mockId }: { mockId: string }) {
  const access = useUcatAccess()
  const detail = useUcatMockDetail(mockId)
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
    await updateMock.mutateAsync({ mockId, payload: { id: mockId, name, isPrivate, setIds: draftSetIds } })
  }

  function reset() {
    const current = detail.data
    if (!current) return
    const setIds = ((current.sets as Array<{ id: string }> | null) ?? []).map((set) => set.id)
    setName(current.name ?? '')
    setIsPrivate(!!current.is_private)
    setDraftSetIds(setIds)
  }

  if (access.isLoading || detail.isLoading || sets.isLoading) return <UcatPageSkeleton rows={6} />

  if (!access.data) return <UcatAccessDenied />
  if (!detail.data) return <div className="p-6">Mock not found.</div>

  return (
    <div className="p-6">
      <UcatPageHeader
        title="Mock Detail"
        backHref="/ucat/mocks"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Mocks', href: '/ucat/mocks' }, { label: 'Detail' }]}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={reset} disabled={!isDirty}>Cancel</Button>
            <Button onClick={save} disabled={!isDirty || updateMock.isPending}>{updateMock.isPending ? 'Saving...' : 'Save'}</Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <section className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">Sets in Mock</h2>
          {draftSetIds.map((setId, index) => {
            const set = setCatalog.find((item) => item.id === setId)
            return (
              <div key={setId} className="flex items-center justify-between rounded border p-2">
                <p className="text-sm"><span className="font-medium">{index + 1}.</span> {set?.label || setId}</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (index === 0) return
                      setDraftSetIds((prev) => {
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
                      if (index === draftSetIds.length - 1) return
                      setDraftSetIds((prev) => {
                        const next = [...prev]
                        ;[next[index + 1], next[index]] = [next[index], next[index + 1]]
                        return next
                      })
                    }}
                  >
                    Down
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setDraftSetIds((prev) => prev.filter((id) => id !== setId))}>
                    Remove
                  </Button>
                </div>
              </div>
            )
          })}

          <div className="rounded border border-dashed p-3">
            <h3 className="mb-2 text-sm font-medium">Add Set</h3>
            <input className="mb-2 w-full rounded border p-2" placeholder="Search sets" value={search} onChange={(e) => setSearch(e.target.value)} />
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
            <input className="w-full rounded border p-2" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
            Private
          </label>
        </aside>
      </div>
    </div>
  )
}
