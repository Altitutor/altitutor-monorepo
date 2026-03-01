'use client'

import { useEffect, useMemo, useState } from 'react'
import type { DataTableFilterDefinition } from '@altitutor/shared'
import { useUcatSetDetail, useUpdateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { isSnapshotDirty, snapshotSetDetail } from '@/features/ucat/shared/lib/dirty-state'
import { parseTimeToSeconds, secondsToTimeString } from '@/features/ucat/shared/lib/time-utils'
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
import type { UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { Trash2 } from 'lucide-react'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatSetEditorContent } from '@/features/ucat/sets/components/UcatSetEditorContent'

/** Shape of each stem in vtutor_ucat_question_set_detail.stems (from DB view) */
type SetDetailStem = { stem_id: string; stem_text?: unknown; questions_meta?: Array<{ id: string; index: number }> }

export function UcatSetEditorDialog({
  open,
  setId,
  onClose,
  onDelete,
}: {
  open: boolean
  setId: string | null
  onClose: () => void
  onDelete?: () => void
}) {
  const detail = useUcatSetDetail(open ? setId : null)
  const updateSet = useUpdateUcatSet()

  const stemCatalogQuery = useUcatStemCatalog(open)
  const stemCatalog = useMemo(() => stemCatalogQuery.data ?? [], [stemCatalogQuery.data])
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const [editingStemId, setEditingStemId] = useState<string | null>(null)
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

  const stemDetail = useUcatQuestionDetail(editingStemId)
  const updateStemMutation = useUpdateUcatQuestionStem()

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

  async function handleStemUpdate(payload: UcatQuestionStemFormValues) {
    if (!editingStemId) return

    const mapped: UcatQuestionStemBundlePayload = {
      stemId: editingStemId,
      sectionId: payload.sectionId,
      categoryId: payload.categoryId || null,
      stemText: payload.stemText,
      isPrivate: payload.isPrivate,
      questions: payload.questions.map((question, index) => ({
        index: index + 1,
        questionText: question.questionText,
        questionType: question.questionType,
        difficulty: question.difficulty,
        timeBurdenSeconds: parseTimeToSeconds(question.timeBurdenSeconds ?? '') ?? null,
        tagIds: question.tagIds ?? [],
        options: question.options.map((option, optionIndex) => ({
          index: optionIndex + 1,
          answerText: option.answerText,
          answerExplanation: option.answerExplanation,
          isAnswer: option.isAnswer,
        })),
      })),
    }

    await updateStemMutation.mutateAsync({ stemId: editingStemId, payload: mapped })
    setEditingStemId(null)
  }

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

  function handleRequestClose() {
    if (!isDirty || window.confirm('Changes made will be lost. Close without saving?')) {
      onClose()
    }
  }

  const headerActions =
    setId != null
      ? (
          <UcatRowActions
            actions={[
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
        )
      : null

  return (
    <>
      <UcatDialogShell
        open={open}
        onClose={handleRequestClose}
        title="Edit Set"
        subtitle="Reorder stems and update set properties"
        onSave={save}
        saveDisabled={!isDirty || updateSet.isPending}
        isSaving={updateSet.isPending}
        headerActions={headerActions}
        hideCancel
      >
        <UcatSetEditorContent
          draftName={draftName}
          draftDescription={draftDescription}
          draftTimeLimit={draftTimeLimit}
          draftPrivate={draftPrivate}
          draftStemIds={draftStemIds}
          setDraftStemIds={setDraftStemIds}
          stemCatalog={stemCatalog as UcatStemCatalogItem[]}
          search={search}
          setSearch={setSearch}
          filters={filters}
          setFilters={setFilters}
          filterDefinitions={filterDefinitions}
          onEditStem={(id) => setEditingStemId(id)}
          onChangeName={setDraftName}
          onChangeDescription={setDraftDescription}
          onChangeTimeLimit={setDraftTimeLimit}
          onChangePrivate={(value) => setDraftPrivate(value)}
        />
      </UcatDialogShell>

      <UcatQuestionStemDialog
        open={!!editingStemId}
        title="Edit Question Stem"
        submitLabel="Save"
        onClose={() => setEditingStemId(null)}
        onSubmit={handleStemUpdate}
        sections={(sectionsQuery.data ?? []).map((section) => ({ id: section.id, name: section.name }))}
        categories={
          (categoriesQuery.data ?? []).map((c) => ({ id: c.id, name: c.name, ucat_section_id: c.ucat_section_id })) as CategoryOption[]
        }
        tags={(tagsQuery.data ?? []).map((t) => ({ id: t.id ?? '', name: t.name ?? '' })) as TagOption[]}
        initial={stemDetail.data}
        loading={updateStemMutation.isPending || stemDetail.isLoading}
      />
    </>
  )
}
