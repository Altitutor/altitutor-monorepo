'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useRouter } from 'next/navigation'
import { Button, useToast } from '@altitutor/ui'
import { useUcatSetDetail, useUpdateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import {
  plainTextToProseMirror,
  proseMirrorToPlainText,
} from '@/features/ucat/shared/lib/rich-text'
import { isSnapshotDirty, snapshotSetDetail } from '@/features/ucat/shared/lib/dirty-state'
import { resolveSetTimeLimitSeconds, type SetTimeLimitSource } from '@/features/ucat/sets/lib/set-time-limit'
import {
  useUcatCategories,
  useUcatQuestionDetail,
  useUcatSections,
  useUcatStemCatalog,
  useUcatTags,
  useUpdateUcatQuestionStem,
  type UcatStemCatalogItem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { UcatQuestionStemDialog } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { formValuesToStemBundlePayload } from '@/features/ucat/questions/lib/stem-editor-form'
import { tutorTableShell } from '@/shared/lib/tutor-visual'
import { cn } from '@/shared/utils'
import type { RichTextJson } from '@/features/ucat/shared/types'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { mapCategoriesToOptions, mapTagsToOptions, buildTaxonomyPathLookup, categoriesToTaxonomyNodes } from '@/features/ucat/shared/lib/taxonomy-paths'
import { buildStemCatalogFilterDefinitions, buildStemCatalogSetFilterOptions, getDefaultStemCatalogFiltersForSetStatus } from '@/features/ucat/shared/lib/stem-catalog-filters'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { UcatPageHeader, UcatPageSkeleton, UcatAccessDenied } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { lifecycleErrorToast, type UcatLifecycleEntityType } from '@/features/ucat/shared/lifecycle-errors'
import { UcatSetEditorContent } from '@/features/ucat/sets/components/UcatSetEditorContent'
import { UcatMockEditorDialog } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { UcatRichTextFloatingToolbar } from '@/features/ucat/shared/components/UcatRichTextFloatingToolbar'
import { useUcatMockBlueprints } from '@/features/ucat/mocks/hooks/useUcatMocks'
import {
  parseLinkedMockBlueprintCompliance,
  recalculateLinkedMockBlueprintCompliance,
} from '@/features/ucat/mocks/lib/blueprint-compliance'

/** Shape of each stem in vtutor_ucat_question_set_detail.stems (from DB view) */
type SetDetailStem = { stem_id: string; stem_text?: unknown; questions_meta?: Array<{ id: string; index: number }> }

type UcatSetDetailPageProps = {
  setId: string
}

export function UcatSetDetailPage({ setId }: UcatSetDetailPageProps) {
  const { toast } = useToast()
  const router = useRouter()
  const access = useUcatAccess()
  const detail = useUcatSetDetail(setId)
  const updateSet = useUpdateUcatSet()

  const stemCatalogQuery = useUcatStemCatalog(true)
  const stemCatalog = useMemo(() => stemCatalogQuery.data ?? [], [stemCatalogQuery.data])
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const setsQuery = useUcatSets()
  const blueprintsQuery = useUcatMockBlueprints()
  const [editingStemId, setEditingStemId] = useState<string | null>(null)
  const [viewingMockId, setViewingMockId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [setFilterSearch, setSetFilterSearch] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState<RichTextJson | null>(null)
  const [draftTimeLimitMinutes, setDraftTimeLimitMinutes] = useState('')
  const [draftTimeLimitSeconds, setDraftTimeLimitSeconds] = useState('')
  const [draftTimeLimitSource, setDraftTimeLimitSource] = useState<SetTimeLimitSource>('custom')
  const [draftTimeLimitSpeed, setDraftTimeLimitSpeed] = useState(1)
  const [draftPrivate, setDraftPrivate] = useState(false)
  const [draftSectionId, setDraftSectionId] = useState('')
  const [draftStemIds, setDraftStemIds] = useState<string[]>([])
  const [baseline, setBaseline] = useState<string>('')
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)
  const storedLinkedBlueprintReports = useMemo(() => {
    const row = (setsQuery.data ?? []).find(candidate => candidate.id === setId)
    return parseLinkedMockBlueprintCompliance(row?.linked_mock_blueprint_compliance)
  }, [setId, setsQuery.data])

  const [filters, setFilters] = useState<Record<string, unknown[]>>({})

  useEffect(() => {
    const current = detail.data
    if (!current) return

    const stems = (current.stems as SetDetailStem[] | null) ?? []
    const stemIds = stems.map((s) => s.stem_id)

    setDraftName(proseMirrorToPlainText(current.name ?? null))
    setDraftDescription((current.description ?? null) as RichTextJson | null)
    const sec = current.time_limit_seconds ?? 0
    setDraftTimeLimitMinutes(String(Math.floor(sec / 60)))
    setDraftTimeLimitSeconds(String(Math.floor(sec % 60)))
    setDraftTimeLimitSource(sec > 0 ? 'custom' : 'untimed')
    setDraftTimeLimitSpeed(1)
    setDraftPrivate(current.access_scope === 'private')
    setDraftSectionId(current.section_id ?? '')
    setDraftStemIds(stemIds)
    setBaseline(
      snapshotSetDetail({
        name: proseMirrorToPlainText(current.name ?? null),
        description: (current.description ?? null) as RichTextJson | null,
        time: current.time_limit_seconds ?? null,
        accessScope: current.access_scope ?? 'public',
        sectionId: current.section_id ?? '',
        stemIds,
      })
    )
    setFilters(getDefaultStemCatalogFiltersForSetStatus(current.status))
  }, [detail.data])

  const stemDetail = useUcatQuestionDetail(editingStemId)
  const updateStemMutation = useUpdateUcatQuestionStem()

  const authoredSection = (sectionsQuery.data ?? []).find((section) => section.id === draftSectionId) ?? null
  const memberQuestionCount = useMemo(
    () =>
      draftStemIds.reduce((sum, stemId) => {
        const stem = stemCatalog.find((item) => item.id === stemId)
        return sum + (stem?.questionsCount ?? 0)
      }, 0),
    [draftStemIds, stemCatalog],
  )
  const firstUcatSection = authoredSection

  const timeLimitSeconds = resolveSetTimeLimitSeconds({
    source: draftTimeLimitSource,
    timePerQuestion: firstUcatSection?.time_per_question,
    questionCount: memberQuestionCount,
    speed: draftTimeLimitSpeed,
    customMinutes: draftTimeLimitMinutes,
    customSeconds: draftTimeLimitSeconds,
  })

  const linkedBlueprintReports = useMemo(() => recalculateLinkedMockBlueprintCompliance({
    linkedReports: storedLinkedBlueprintReports,
    blueprints: blueprintsQuery.data ?? [],
    setCatalog: (setsQuery.data ?? []).map(set => {
      return {
        id: set.id ?? '',
        name: proseMirrorToPlainText(set.name ?? null) || 'Untitled',
        sectionDisplay: '',
        sectionCount: set.section_id ? 1 : 0,
        firstSectionNumber: set.section_number ?? null,
        question_count: set.question_count ?? null,
        time_limit_seconds: set.time_limit_seconds ?? null,
        access_scope: set.access_scope ?? null,
        stem_count: set.stem_count ?? null,
      }
    }),
    stemCatalog,
    editedSet: {
      id: setId,
      stemIds: draftStemIds,
      timeLimitSeconds,
      sectionNumbers: firstUcatSection?.section_number == null ? [] : [firstUcatSection.section_number],
    },
  }), [
    blueprintsQuery.data,
    draftStemIds,
    firstUcatSection,
    setId,
    setsQuery.data,
    stemCatalog,
    storedLinkedBlueprintReports,
    timeLimitSeconds,
  ])

  const isTimeLimitValid =
    draftTimeLimitSource === 'untimed' ||
    draftTimeLimitSource === 'paced' ||
    (timeLimitSeconds != null && timeLimitSeconds > 0)
  const isDirty = useMemo(() => {
    const snapshot = snapshotSetDetail({
      name: draftName,
      description: draftDescription,
      time: timeLimitSeconds,
      accessScope: draftPrivate ? 'private' : 'public',
      sectionId: draftSectionId,
      stemIds: draftStemIds,
    })
    return isSnapshotDirty(snapshot, baseline)
  }, [baseline, draftName, draftDescription, draftPrivate, draftSectionId, draftStemIds, timeLimitSeconds])

  const filterDefinitions = useMemo(
    () => {
      const setsList = (setsQuery.data ?? []).filter(
        (set) => !(set as { deleted_at?: string | null }).deleted_at,
      )
      return buildStemCatalogFilterDefinitions(
        sectionsQuery.data ?? [],
        categoriesQuery.data ?? [],
        tagsQuery.data ?? [],
        filters,
        buildStemCatalogSetFilterOptions(setsList, setFilterSearch, { includeNotInPublishedSet: true }),
        { lockedSectionId: draftSectionId || null },
      )
    },
    [sectionsQuery.data, categoriesQuery.data, tagsQuery.data, filters, setsQuery.data, setFilterSearch, draftSectionId],
  )

  const publishedSetIds = useMemo(() => {
    const ids = new Set<string>()
    for (const set of setsQuery.data ?? []) {
      if ((set as { deleted_at?: string | null }).deleted_at) continue
      if (set.status === 'published' && set.id) ids.add(set.id)
    }
    return ids
  }, [setsQuery.data])

  const categoryPathLookup = useMemo(
    () => buildTaxonomyPathLookup(categoriesToTaxonomyNodes(categoriesQuery.data ?? [])),
    [categoriesQuery.data],
  )

  function openLifecycleEntity(entityType: UcatLifecycleEntityType, entityId: string) {
    if (entityType === 'stem') {
      setEditingStemId(entityId)
      return true
    }
    if (entityType === 'mock') {
      setViewingMockId(entityId)
      return true
    }
    if (entityType === 'set' && entityId === setId) {
      setEditingStemId(null)
      return true
    }
    return false
  }

  async function handleStemUpdate(payload: UcatQuestionStemFormValues) {
    if (!editingStemId) return

    const mapped = formValuesToStemBundlePayload(payload, editingStemId)

    try {
      await updateStemMutation.mutateAsync({ stemId: editingStemId, payload: mapped })
      setEditingStemId(null)
    } catch (error) {
      toast(lifecycleErrorToast(error, 'Failed to save', router.push, openLifecycleEntity))
    }
  }

  async function save() {
    try {
      await updateSet.mutateAsync({
        setId,
        payload: {
          id: setId,
          name: plainTextToProseMirror(draftName),
          description: draftDescription,
          timeLimitSeconds,
          accessScope: draftPrivate ? 'private' : 'public',
          sectionId: draftSectionId,
          stemIds: draftStemIds,
        },
      })
    } catch (error) {
      toast(lifecycleErrorToast(error, 'Failed to save', router.push, openLifecycleEntity))
    }
  }

  const isLoading =
    access.isLoading ||
    detail.isLoading ||
    sectionsQuery.isLoading ||
    categoriesQuery.isLoading ||
    tagsQuery.isLoading ||
    stemCatalogQuery.isLoading

  if (isLoading) return <UcatPageSkeleton rows={6} />
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="Edit UCAT Set"
        description={detail.data?.name ? proseMirrorToPlainText(detail.data.name) : 'Edit question set'}
        backHref="/ucat/sets"
        breadcrumbs={[
          { label: 'UCAT', href: '/ucat' },
          { label: 'Sets', href: '/ucat/sets' },
          {
            label: detail.data?.name ? proseMirrorToPlainText(detail.data.name) || 'Set' : 'Set',
          },
        ]}
        actions={
          <Button onClick={save} disabled={!isDirty || !isTimeLimitValid || !draftSectionId || updateSet.isPending}>
            {updateSet.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        }
      />

      <div className={cn('relative mt-4 flex h-[70vh] min-h-0 flex-col', tutorTableShell)}>
        <UcatSetEditorContent
          draftName={draftName}
          draftDescription={draftDescription}
          draftTimeLimitMinutes={draftTimeLimitMinutes}
          draftTimeLimitSeconds={draftTimeLimitSeconds}
          draftTimeLimitSource={draftTimeLimitSource}
          draftTimeLimitSpeed={draftTimeLimitSpeed}
          draftPrivate={draftPrivate}
          draftSectionId={draftSectionId}
          onChangeSectionId={setDraftSectionId}
          draftStemIds={draftStemIds}
          setDraftStemIds={setDraftStemIds}
          stemCatalog={stemCatalog as unknown as UcatStemCatalogItem[]}
          setDetailStems={(detail.data?.stems as SetDetailStem[] | null) ?? []}
          search={search}
          setSearch={setSearch}
          filters={filters}
          setFilters={setFilters}
          filterDefinitions={filterDefinitions}
          categoryPathLookup={categoryPathLookup}
          filterSearchValues={{ question_set_id: setFilterSearch }}
          onFilterSearchChange={(filterKey, value) => {
            if (filterKey === 'question_set_id') setSetFilterSearch(value)
          }}
          publishedSetIds={publishedSetIds}
          currentSetId={setId}
          stemCatalogLoading={stemCatalogQuery.isLoading}
          onEditStem={(id) => setEditingStemId(id)}
          onChangeName={setDraftName}
          onChangeDescription={setDraftDescription}
          onChangeTimeLimitMinutes={setDraftTimeLimitMinutes}
          onChangeTimeLimitSeconds={setDraftTimeLimitSeconds}
          onChangeTimeLimitSource={setDraftTimeLimitSource}
          onChangeTimeLimitSpeed={setDraftTimeLimitSpeed}
          onChangePrivate={(value) => setDraftPrivate(value)}
          onActiveTextEditorChange={setActiveTextEditor}
          linkedBlueprintReports={linkedBlueprintReports}
          onViewMock={setViewingMockId}
          sections={(sectionsQuery.data ?? []).map((s) => ({
            id: s.id ?? '',
            name: s.name ?? null,
            section_number: s.section_number ?? null,
            time_limit_seconds: s.time_limit_seconds ?? null,
            time_per_question: s.time_per_question ?? null,
            number_of_questions: s.number_of_questions ?? null,
          }))}
        />
        <UcatRichTextFloatingToolbar editor={activeTextEditor} />
      </div>

      <UcatMockEditorDialog
        open={!!viewingMockId}
        mockId={viewingMockId}
        onClose={() => setViewingMockId(null)}
      />

      <UcatQuestionStemDialog
        open={!!editingStemId}
        title="Edit Question Stem"
        submitLabel="Save"
        onClose={() => setEditingStemId(null)}
        onSubmit={handleStemUpdate}
        sections={(sectionsQuery.data ?? []).map((section) => ({
          id: section.id,
          name: section.name,
          display_columns: section.display_columns,
        }))}
        categories={mapCategoriesToOptions(categoriesQuery.data ?? []) as CategoryOption[]}
        tags={mapTagsToOptions(tagsQuery.data ?? []) as TagOption[]}
        initial={stemDetail.data}
        loading={updateStemMutation.isPending || stemDetail.isLoading}
        onOpenLifecycleEntity={openLifecycleEntity}
      />
    </div>
  )
}
