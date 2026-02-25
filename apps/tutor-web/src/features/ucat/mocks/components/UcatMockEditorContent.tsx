'use client'

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui'
import { UcatSortableList } from '@/features/ucat/shared/drag-list'
import { formatSecondsToDuration } from '@/features/ucat/shared/lib/time-utils'
import type { SetOption } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import React from 'react'

type UcatMockEditorContentProps = {
  name: string
  isPrivate: boolean
  setName: (value: string) => void
  setIsPrivate: (value: boolean) => void
  draftSetIds: string[]
  setDraftSetIds: React.Dispatch<React.SetStateAction<string[]>>
  search: string
  setSearch: (value: string) => void
  setCatalog: SetOption[]
}

export function UcatMockEditorContent({
  name,
  isPrivate,
  setName,
  setIsPrivate,
  draftSetIds,
  setDraftSetIds,
  search,
  setSearch,
  setCatalog,
}: UcatMockEditorContentProps) {
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return setCatalog.filter(
      (set) =>
        !draftSetIds.includes(set.id) &&
        (q === '' || set.name.toLowerCase().includes(q) || set.sectionDisplay.toLowerCase().includes(q))
    )
  }, [draftSetIds, search, setCatalog])

  return (
    <div className="h-full flex">
      <section className="flex-1 min-w-0 overflow-y-auto border-r p-6 space-y-3">
        <h2 className="font-semibold">Sets in Mock</h2>

        <UcatSortableList
          ids={draftSetIds}
          onChange={setDraftSetIds}
          onRemove={(id) => setDraftSetIds((prev) => prev.filter((setId) => setId !== id))}
          renderLabel={(id, index) => {
            const set = setCatalog.find((item) => item.id === id)
            if (!set)
              return (
                <>
                  <span className="font-medium">{index + 1}.</span> {id.slice(0, 8)}
                </>
              )
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
          <Input
            placeholder="Search sets"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-2"
          />
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
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="private">Private</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </aside>
    </div>
  )
}

