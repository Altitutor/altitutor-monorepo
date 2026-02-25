'use client'

import { useEffect, useMemo, useState } from 'react'
import { Input, ListToolbar, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from '@altitutor/ui'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { useUcatSetDetail, useUpdateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { isSnapshotDirty, snapshotSetDetail } from '@/features/ucat/shared/lib/dirty-state'
import { parseTimeToSeconds, secondsToTimeString } from '@/features/ucat/shared/lib/time-utils'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatSortableList } from '@/features/ucat/shared/drag-list'
import {
  useUcatCategories,
  useUcatSections,
  useUcatStemCatalog,
  type UcatStemCatalogItem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'

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

  const stemCatalogQuery = useUcatStemCatalog(open)
  const stemCatalog = stemCatalogQuery.data ?? []
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
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

  const [filters, setFilters] = useState<Record<string, unknown[]>>({})

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

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => {
    const base: DataTableFilterDefinition[] = [
      { key: 'section_id', label: 'Section' },
      { key: 'question_stem_category_id', label: 'Category' },
      {
        key: 'visibility',
        label: 'Visibility',
        options: [
          { label: 'Public', value: 'public' },
          { label: 'Private', value: 'private' },
        ],
      },
      {
        key: 'question_type',
        label: 'Type',
        options: [
          { label: 'Multiple Choice', value: 'multiple_choice' },
          { label: 'Syllogism', value: 'syllogism' },
        ],
      },
    ]

    const sections = sectionsQuery.data ?? []
    const categories = categoriesQuery.data ?? []

    return [
      {
        ...base[0],
        options: sections.map((s) => ({
          label: s.name ?? 'Untitled',
          // Use section_number for filtering to avoid any ID mismatch issues
          value: s.section_number ?? 0,
        })),
      },
      {
        ...base[1],
        options: categories.map((c) => ({ label: c.name ?? 'Untitled', value: c.id ?? '' })),
      },
      base[2],
      base[3],
    ]
  }, [sectionsQuery.data, categoriesQuery.data])

  const filteredCatalog = useMemo(() => {
    const searchTrimmed = search.trim().toLowerCase()
    const sectionFilterRaw = (filters.section_id?.[0] as unknown) ?? ''
    const categoryFilter = (filters.question_stem_category_id?.[0] as string | undefined) || ''
    const visibilityFilter = (filters.visibility?.[0] as string | undefined) || ''
    const questionTypeFilter = (filters.question_type?.[0] as string | undefined) || ''

    return stemCatalog.filter((stem) => {
      if (draftStemIds.includes(stem.id)) return false

      const searchHit =
        !searchTrimmed ||
        stem.text.toLowerCase().includes(searchTrimmed) ||
        stem.sectionName.toLowerCase().includes(searchTrimmed) ||
        (stem.categoryName ?? '').toLowerCase().includes(searchTrimmed)

      if (!searchHit) return false

      // Section filter: compare by section number to match the options above
      if (sectionFilterRaw !== '' && sectionFilterRaw != null) {
        const sectionFilterNumber = Number(sectionFilterRaw)
        if (Number.isFinite(sectionFilterNumber) && stem.sectionNumber !== sectionFilterNumber) {
          return false
        }
      }
      if (categoryFilter && stem.categoryId !== categoryFilter) return false

      if (visibilityFilter === 'public' && stem.isPrivate) return false
      if (visibilityFilter === 'private' && !stem.isPrivate) return false

      if (
        questionTypeFilter &&
        !stem.questionTypes.includes(questionTypeFilter as 'multiple_choice' | 'syllogism')
      ) {
        return false
      }

      return true
    })
  }, [stemCatalog, draftStemIds, search, filters])

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
              {filteredCatalog.slice(0, 40).map((stem) => (
                <button
                  key={stem.id}
                  type="button"
                  className="block w-full rounded border px-2 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => setDraftStemIds((prev) => [...prev, stem.id])}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="line-clamp-2 break-words text-xs sm:text-sm">
                        {stem.text || stem.id}
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {stem.sectionNumber}. {stem.sectionName}
                      </div>
                    </div>
                    <div className="ml-2 shrink-0 text-xs text-muted-foreground">
                      {stem.questionsCount} {stem.questionsCount === 1 ? 'question' : 'questions'}
                    </div>
                  </div>
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
