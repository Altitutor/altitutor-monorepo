'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useRouter } from 'next/navigation'
import { useToast } from '@altitutor/ui'
import { useUcatSetDetail, useUpdateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import {
  plainTextToProseMirror,
  proseMirrorToPlainText,
} from '@/features/ucat/shared/lib/rich-text'
import { isSnapshotDirty, snapshotSetDetail } from '@/features/ucat/shared/lib/dirty-state'
import { resolveSetTimeLimitSeconds, type SetTimeLimitSource } from '@/features/ucat/sets/lib/set-time-limit'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
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
import type { RichTextJson } from '@/features/ucat/shared/types'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { mapCategoriesToOptions, mapTagsToOptions, buildTaxonomyPathLookup, categoriesToTaxonomyNodes } from '@/features/ucat/shared/lib/taxonomy-paths'
import { buildStemCatalogFilterDefinitions, buildStemCatalogSetFilterOptions, getDefaultStemCatalogFiltersForSetStatus } from '@/features/ucat/shared/lib/stem-catalog-filters'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { Trash2 } from 'lucide-react'
import { useUcatCopyId } from '@/features/ucat/shared/hooks/useUcatCopyId'
import { buildCopyIdRowAction, withCopyIdDescription } from '@/features/ucat/shared/lib/copy-id-actions'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { lifecycleErrorToast, type UcatLifecycleEntityType } from '@/features/ucat/shared/lifecycle-errors'
import { UcatSetEditorContent } from '@/features/ucat/sets/components/UcatSetEditorContent'
import { UcatSetPreviewContent } from '@/features/ucat/sets/components/UcatSetPreviewContent'
import { UcatMockEditorDialog } from '@/features/ucat/mocks/components/UcatMockEditorDialog'
import { UcatStemEditorHeaderControls } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorHeaderControls'
import type { StemEditorMode } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorPropertiesPanel'
import { UcatPdfExportDialog } from '@/features/ucat/shared/components/UcatPdfExportDialog'
import { buildUcatPdfExportAction } from '@/features/ucat/shared/pdf/pdf-export-action'
import { useUcatMockBlueprints } from '@/features/ucat/mocks/hooks/useUcatMocks'
import {
  parseLinkedMockBlueprintCompliance,
  recalculateLinkedMockBlueprintCompliance,
} from '@/features/ucat/mocks/lib/blueprint-compliance'

/** Shape of each stem in vtutor_ucat_question_set_detail.stems (from DB view) */
type SetDetailStem = { stem_id: string; stem_text?: unknown; questions_meta?: Array<{ id: string; index: number }> }

export function UcatSetEditorDialog({
  open,
  setId,
  onClose,
  onDelete,
  warningPills,
}: {
  open: boolean
  setId: string | null
  onClose: () => void
  onDelete?: () => void
  warningPills?: string[]
}) {
  const { toast } = useToast()
  const router = useRouter()
  const { copyId } = useUcatCopyId()
  const detail = useUcatSetDetail(open ? setId : null)
  const updateSet = useUpdateUcatSet()

  const stemCatalogQuery = useUcatStemCatalog(open)
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
  const [editorMode, setEditorMode] = useState<StemEditorMode>('edit')
  const [showAnswer, setShowAnswer] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const storedLinkedBlueprintReports = useMemo(() => {
    const row = (setsQuery.data ?? []).find(candidate => candidate.id === setId)
    return parseLinkedMockBlueprintCompliance(row?.linked_mock_blueprint_compliance)
  }, [setId, setsQuery.data])

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
  }, [detail.data])

  const [filters, setFilters] = useState<Record<string, unknown[]>>({})
  const setDetailId = detail.data?.id
  const setDetailStatus = detail.data?.status

  useEffect(() => {
    if (!open) {
      setActiveTextEditor(null)
      setEditorMode('edit')
      setShowAnswer(false)
      setExportDialogOpen(false)
      setFilters({})
      setSearch('')
      setSetFilterSearch('')
      return
    }
    if (!setDetailId || setDetailId !== setId) return
    setFilters(getDefaultStemCatalogFiltersForSetStatus(setDetailStatus))
  }, [open, setId, setDetailId, setDetailStatus])

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
      id: setId ?? '',
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
    if (!setId) return
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
      onClose()
    } catch (error) {
      toast(lifecycleErrorToast(error, 'Failed to save', router.push, openLifecycleEntity))
    }
  }

  function handleRequestClose() {
    if (!isDirty || window.confirm('Changes made will be lost. Close without saving?')) {
      onClose()
    }
  }

  const copyIdAction =
    setId != null
      ? buildCopyIdRowAction(
          [
            { label: 'Set', id: setId, description: withCopyIdDescription(draftName) },
            ...draftStemIds.map((stemId, index) => ({
              label: `Stem ${index + 1}`,
              id: stemId,
              description: withCopyIdDescription(stemCatalog.find((stem) => stem.id === stemId)?.text),
            })),
          ],
          copyId,
        )
      : null

  const headerActions = setId != null ? (
        <UcatRowActions
          actions={[
            ...(copyIdAction ? [copyIdAction] : []),
            buildUcatPdfExportAction(() => setExportDialogOpen(true)),
            {
              label: 'Open in page',
              href: `/ucat/sets/${setId}`,
            },
            ...(onDelete
              ? [
                  {
                    label: 'Delete',
                    icon: <Trash2 className="h-4 w-4" />,
                    onClick: onDelete,
                    destructive: true,
                  },
                ]
              : []),
          ]}
        />
      ) : null

  return (
    <>
      <UcatDialogShell
        open={open}
        onClose={handleRequestClose}
        title="Edit Set"
        subtitle={
          editorMode === 'edit'
            ? 'Reorder stems and update set properties'
            : 'Preview every question in this set'
        }
        onSave={save}
        saveDisabled={!isDirty || !isTimeLimitValid || !draftSectionId || updateSet.isPending}
        isSaving={updateSet.isPending}
        headerControls={
          <UcatStemEditorHeaderControls
            mode={editorMode}
            onModeChange={setEditorMode}
            showAnswer={showAnswer}
            onShowAnswerChange={setShowAnswer}
          />
        }
        headerActions={headerActions}
        warningPills={warningPills}
        hideCancel
        defaultExpanded
        mobileFullscreen
        richTextToolbarEditor={editorMode === 'edit' ? activeTextEditor : null}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {editorMode === 'edit' ? (
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
              stemCatalog={stemCatalog as UcatStemCatalogItem[]}
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
          ) : (
            <UcatSetPreviewContent
              stemIds={draftStemIds}
              stemCatalog={stemCatalog as UcatStemCatalogItem[]}
              showAnswer={showAnswer}
              isLoading={stemCatalogQuery.isLoading}
              showDistribution
            />
          )}
        </div>
      </UcatDialogShell>

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

      <UcatPdfExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        source={{
          kind: 'set',
          title: draftName.trim() || 'Untitled set',
          stemIds: draftStemIds,
        }}
      />
    </>
  )
}
