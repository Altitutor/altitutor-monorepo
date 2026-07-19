'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import Link from 'next/link'
import { useToast } from '@altitutor/ui'
import { useUcatSetDetail, useUpdateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import {
  filterOptionsWithContent,
  plainTextToProseMirror,
  proseMirrorToPlainText,
} from '@/features/ucat/shared/lib/rich-text'
import { isSnapshotDirty, snapshotSetDetail } from '@/features/ucat/shared/lib/dirty-state'
import { minutesSecondsToTotal, parseTimeToSeconds } from '@/features/ucat/shared/lib/time-utils'
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
import type { UcatQuestionStemBundlePayload, RichTextJson } from '@/features/ucat/shared/types'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { mapCategoriesToOptions, mapTagsToOptions, buildTaxonomyPathLookup, categoriesToTaxonomyNodes } from '@/features/ucat/shared/lib/taxonomy-paths'
import { buildStemCatalogFilterDefinitions, buildStemCatalogSetFilterOptions } from '@/features/ucat/shared/lib/stem-catalog-filters'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { Trash2 } from 'lucide-react'
import { useUcatCopyId } from '@/features/ucat/shared/hooks/useUcatCopyId'
import { buildCopyIdRowAction, withCopyIdDescription } from '@/features/ucat/shared/lib/copy-id-actions'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { parseUcatVisibilityError } from '@/features/ucat/shared/lib/visibility-error'
import { UcatSetEditorContent } from '@/features/ucat/sets/components/UcatSetEditorContent'
import { UcatSetPreviewContent } from '@/features/ucat/sets/components/UcatSetPreviewContent'
import { UcatStemEditorHeaderControls } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorHeaderControls'
import type { StemEditorMode } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorPropertiesPanel'
import { UcatPdfExportDialog } from '@/features/ucat/shared/components/UcatPdfExportDialog'
import { buildUcatPdfExportAction } from '@/features/ucat/shared/pdf/pdf-export-action'

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
  const { copyId } = useUcatCopyId()
  const detail = useUcatSetDetail(open ? setId : null)
  const updateSet = useUpdateUcatSet()

  const stemCatalogQuery = useUcatStemCatalog(open)
  const stemCatalog = useMemo(() => stemCatalogQuery.data ?? [], [stemCatalogQuery.data])
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const setsQuery = useUcatSets()
  const [editingStemId, setEditingStemId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [setFilterSearch, setSetFilterSearch] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState<RichTextJson | null>(null)
  const [draftIsTimed, setDraftIsTimed] = useState(true)
  const [draftTimeLimitMinutes, setDraftTimeLimitMinutes] = useState('')
  const [draftTimeLimitSeconds, setDraftTimeLimitSeconds] = useState('')
  const [draftTimeLimitSource, setDraftTimeLimitSource] = useState<'untimed' | 'section_full' | 'section_auto' | 'custom'>('custom')
  const [draftTimeLimitSpeed, setDraftTimeLimitSpeed] = useState(1)
  const [draftPrivate, setDraftPrivate] = useState(false)
  const [draftStemIds, setDraftStemIds] = useState<string[]>([])
  const [baseline, setBaseline] = useState<string>('')
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)
  const [editorMode, setEditorMode] = useState<StemEditorMode>('edit')
  const [showAnswer, setShowAnswer] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  useEffect(() => {
    const current = detail.data
    if (!current) return

    const stems = (current.stems as SetDetailStem[] | null) ?? []
    const stemIds = stems.map((s) => s.stem_id)

    setDraftName(proseMirrorToPlainText(current.name ?? null))
    setDraftDescription((current.description ?? null) as RichTextJson | null)
    const sec = current.time_limit_seconds ?? 0
    setDraftIsTimed(sec > 0)
    setDraftTimeLimitMinutes(String(Math.floor(sec / 60)))
    setDraftTimeLimitSeconds(String(Math.floor(sec % 60)))
    setDraftTimeLimitSource(sec > 0 ? 'custom' : 'untimed')
    setDraftTimeLimitSpeed(1)
    setDraftPrivate(current.access_scope === 'private')
    setDraftStemIds(stemIds)
    setBaseline(
      snapshotSetDetail({
        name: proseMirrorToPlainText(current.name ?? null),
        description: (current.description ?? null) as RichTextJson | null,
        time: current.time_limit_seconds ?? null,
        accessScope: current.access_scope ?? 'public',
        stemIds,
      })
    )
  }, [detail.data])

  useEffect(() => {
    if (!open) {
      setActiveTextEditor(null)
      setEditorMode('edit')
      setShowAnswer(false)
      setExportDialogOpen(false)
    }
  }, [open])

  const [filters, setFilters] = useState<Record<string, unknown[]>>({})

  const stemDetail = useUcatQuestionDetail(editingStemId)
  const updateStemMutation = useUpdateUcatQuestionStem()

  const setSectionsFromStems = useMemo(() => {
    const sectionMap = new Map<string, { sectionId: string; questionCount: number }>()
    for (const stemId of draftStemIds) {
      const stem = stemCatalog.find((s) => s.id === stemId)
      if (!stem?.sectionId) continue
      const existing = sectionMap.get(stem.sectionId)
      if (existing) {
        existing.questionCount += stem.questionsCount
      } else {
        sectionMap.set(stem.sectionId, { sectionId: stem.sectionId, questionCount: stem.questionsCount })
      }
    }
    return Array.from(sectionMap.values())
  }, [draftStemIds, stemCatalog])

  const setSectionCount = setSectionsFromStems.length
  const firstSetSection = setSectionsFromStems[0]
  const firstUcatSection = firstSetSection
    ? (sectionsQuery.data ?? []).find((s) => s.id === firstSetSection.sectionId)
    : null

  const sectionFullTimeSeconds = firstUcatSection?.time_limit_seconds ?? null
  const sectionAutoTimeSeconds = useMemo(() => {
    let total = 0
    const sectionsData = sectionsQuery.data ?? []
    for (const ss of setSectionsFromStems) {
      const sec = sectionsData.find((s) => s.id === ss.sectionId)
      const tpq = sec?.time_per_question
      if (tpq != null && tpq > 0) {
        total += ss.questionCount * tpq
      }
    }
    return total > 0 ? total : null
  }, [setSectionsFromStems, sectionsQuery.data])

  const timeLimitSeconds = (() => {
    if (draftTimeLimitSource === 'untimed' || !draftIsTimed) return null
    if (draftTimeLimitSource === 'section_full' && setSectionCount === 1 && sectionFullTimeSeconds != null && sectionFullTimeSeconds > 0) {
      return sectionFullTimeSeconds
    }
    if (draftTimeLimitSource === 'section_auto' && setSectionCount === 1 && sectionAutoTimeSeconds != null) {
      const speed = Math.max(0.1, Math.min(2, draftTimeLimitSpeed))
      return Math.round(sectionAutoTimeSeconds / speed)
    }
    return minutesSecondsToTotal(draftTimeLimitMinutes, draftTimeLimitSeconds)
  })()

  const isTimeLimitValid =
    !draftIsTimed ||
    (timeLimitSeconds != null &&
      timeLimitSeconds > 0 &&
      !(draftTimeLimitSource === 'section_auto' && setSectionCount > 1))
  const isDirty = useMemo(() => {
    const snapshot = snapshotSetDetail({
      name: draftName,
      description: draftDescription,
      time: timeLimitSeconds,
      accessScope: draftPrivate ? 'private' : 'public',
      stemIds: draftStemIds,
    })
    return isSnapshotDirty(snapshot, baseline)
  }, [baseline, draftName, draftDescription, draftPrivate, draftStemIds, timeLimitSeconds])

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
        buildStemCatalogSetFilterOptions(setsList, setFilterSearch),
      )
    },
    [sectionsQuery.data, categoriesQuery.data, tagsQuery.data, filters, setsQuery.data, setFilterSearch],
  )

  const categoryPathLookup = useMemo(
    () => buildTaxonomyPathLookup(categoriesToTaxonomyNodes(categoriesQuery.data ?? [])),
    [categoriesQuery.data],
  )

  async function handleStemUpdate(payload: UcatQuestionStemFormValues) {
    if (!editingStemId) return

    const mapped: UcatQuestionStemBundlePayload = {
      stemId: editingStemId,
      sectionId: payload.sectionId,
      categoryId: payload.categoryId || null,
      stemText: payload.stemText,
      accessScope: payload.accessScope,
      questions: payload.questions.map((question, index) => ({
        id: question.id,
        index: index + 1,
        questionText: question.questionText,
        questionType: question.questionType,
        difficulty: question.difficulty,
        timeBurdenSeconds: parseTimeToSeconds(question.timeBurdenSeconds ?? '') ?? null,
        tagIds: question.tagIds ?? [],
        options: filterOptionsWithContent(question.options).map((option, optionIndex) => ({
          id: option.id,
          index: optionIndex + 1,
          answerText: option.answerText,
          answerExplanation: option.answerExplanation,
          isAnswer: option.isAnswer,
        })),
      })),
    }

    try {
      await updateStemMutation.mutateAsync({ stemId: editingStemId, payload: mapped })
      setEditingStemId(null)
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save question stem'
      const parsed = parseUcatVisibilityError(msg)
      toast({
        title: 'Failed to save',
        description: parsed.link ? (
          <span>
            {parsed.textBeforeLink}{' '}
            <Link href={parsed.link.href} className="underline font-medium">
              {parsed.link.label}
            </Link>
          </span>
        ) : (
          msg
        ),
        variant: 'destructive',
      })
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
          stemIds: draftStemIds,
        },
      })
      onClose()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to save set'
      const parsed = parseUcatVisibilityError(msg)
      toast({
        title: 'Failed to save',
        description: parsed.link ? (
          <span>
            {parsed.textBeforeLink}{' '}
            <Link href={parsed.link.href} className="underline font-medium">
              {parsed.link.label}
            </Link>
          </span>
        ) : (
          msg
        ),
        variant: 'destructive',
      })
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
        saveDisabled={!isDirty || !isTimeLimitValid || updateSet.isPending}
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
              draftIsTimed={draftIsTimed}
              draftTimeLimitMinutes={draftTimeLimitMinutes}
              draftTimeLimitSeconds={draftTimeLimitSeconds}
              draftTimeLimitSource={draftTimeLimitSource}
              draftTimeLimitSpeed={draftTimeLimitSpeed}
              draftPrivate={draftPrivate}
              draftStemIds={draftStemIds}
              setDraftStemIds={setDraftStemIds}
              stemCatalog={stemCatalog as UcatStemCatalogItem[]}
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
              stemCatalogLoading={stemCatalogQuery.isLoading}
              onEditStem={(id) => setEditingStemId(id)}
              onChangeName={setDraftName}
              onChangeDescription={setDraftDescription}
              onChangeIsTimed={(v) => {
                setDraftIsTimed(v)
                if (!v) {
                  setDraftTimeLimitMinutes('')
                  setDraftTimeLimitSeconds('')
                  setDraftTimeLimitSource('untimed')
                }
              }}
              onChangeTimeLimitMinutes={setDraftTimeLimitMinutes}
              onChangeTimeLimitSeconds={setDraftTimeLimitSeconds}
              onChangeTimeLimitSource={setDraftTimeLimitSource}
              onChangeTimeLimitSpeed={setDraftTimeLimitSpeed}
              onChangePrivate={(value) => setDraftPrivate(value)}
              onActiveTextEditorChange={setActiveTextEditor}
              sections={(sectionsQuery.data ?? []).map((s) => ({
                id: s.id ?? '',
                name: s.name ?? null,
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
