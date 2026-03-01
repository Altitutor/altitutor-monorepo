'use client'

import { Button, Input, ListToolbar, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@altitutor/ui'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { UcatSortableList } from '@/features/ucat/shared/drag-list'
import type { UcatStemCatalogItem } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { Pencil, Plus } from 'lucide-react'
import React from 'react'

type UcatSetEditorContentProps = {
  draftName: string
  draftDescription: string
  draftTimeLimit: string
  draftPrivate: boolean
  draftStemIds: string[]
  setDraftStemIds: React.Dispatch<React.SetStateAction<string[]>>
  stemCatalog: UcatStemCatalogItem[]
  search: string
  setSearch: (value: string) => void
  filters: Record<string, unknown[]>
  setFilters: (value: Record<string, unknown[]>) => void
  filterDefinitions: DataTableFilterDefinition[]
  onEditStem: (id: string) => void
  onChangeName: (value: string) => void
  onChangeDescription: (value: string) => void
  onChangeTimeLimit: (value: string) => void
  onChangePrivate: (value: boolean) => void
}

export function UcatSetEditorContent({
  draftName,
  draftDescription,
  draftTimeLimit,
  draftPrivate,
  draftStemIds,
  setDraftStemIds,
  stemCatalog,
  search,
  setSearch,
  filters,
  setFilters,
  filterDefinitions,
  onEditStem,
  onChangeName,
  onChangeDescription,
  onChangeTimeLimit,
  onChangePrivate,
}: UcatSetEditorContentProps) {
  return (
    <div className="h-full flex">
      <section className="flex-1 min-w-0 overflow-y-auto border-r p-6 space-y-3">
        <h2 className="font-semibold">Stems in Set</h2>

        <UcatSortableList
          ids={draftStemIds}
          onChange={setDraftStemIds}
          onRemove={(id) => setDraftStemIds((prev) => prev.filter((stemId) => stemId !== id))}
          onEdit={onEditStem}
          renderLabel={(id, index) => {
            const stem = stemCatalog.find((item) => item.id === id)
            return (
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-xs font-medium">{index + 1}.</span>
                <div className="min-w-0">
                  <div className="line-clamp-2 break-words text-xs sm:text-sm">
                    {stem?.text || id}
                  </div>
                  {stem && (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {stem.sectionNumber}. {stem.sectionName} · {stem.questionsCount}{' '}
                      {stem.questionsCount === 1 ? 'question' : 'questions'}
                    </div>
                  )}
                </div>
              </div>
            )
          }}
        />

        <div className="pt-2">
          <h3 className="mb-2 text-sm font-medium">Add Stem</h3>
          <div className="mb-2">
            <ListToolbar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search stems"
              filterDefinitions={filterDefinitions}
              filters={filters}
              onFiltersChange={setFilters}
            />
          </div>
          <div className="max-h-52 space-y-1 overflow-auto">
            {stemCatalog
              .filter((stem) => !draftStemIds.includes(stem.id))
              .slice(0, 40)
              .map((stem) => (
                <div
                  key={stem.id}
                  className="flex w-full items-start justify-between gap-2 rounded border px-2 py-2 text-left text-sm hover:bg-muted"
                >
                  <div className="min-w-0">
                    <div className="line-clamp-2 break-words text-xs sm:text-sm">
                      {stem.text || stem.id}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {stem.sectionNumber}. {stem.sectionName}
                    </div>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {stem.questionsCount} {stem.questionsCount === 1 ? 'question' : 'questions'}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => onEditStem(stem.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setDraftStemIds((prev) => [...prev, stem.id])}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      <aside className="w-80 flex-shrink-0 overflow-y-auto border-l p-6 space-y-3">
        <h2 className="font-semibold">Set Properties</h2>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Name</span>
          <Input value={draftName} onChange={(e) => onChangeName(e.target.value)} placeholder="Set name" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Description</span>
          <Textarea
            className="min-h-24"
            value={draftDescription}
            onChange={(e) => onChangeDescription(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Time limit (mm:ss or seconds)</span>
          <Input
            type="text"
            value={draftTimeLimit}
            onChange={(e) => onChangeTimeLimit(e.target.value)}
            placeholder="e.g. 1:30 or 90"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Visibility</span>
          <Select value={draftPrivate ? 'private' : 'public'} onValueChange={(v) => onChangePrivate(v === 'private')}>
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

