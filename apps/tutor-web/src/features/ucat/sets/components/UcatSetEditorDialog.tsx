'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { DataTableFilterDefinition } from '@altitutor/shared'
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
import type { UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { Trash2 } from 'lucide-react'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatVisibilityCascadeWarning } from '@/features/ucat/shared/components/UcatVisibilityCascadeWarning'
import { parseUcatVisibilityError } from '@/features/ucat/shared/lib/visibility-error'
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
  const { toast } = useToast()
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
  const [draftIsTimed, setDraftIsTimed] = useState(true)
  const [draftTimeLimitMinutes, setDraftTimeLimitMinutes] = useState('')
  const [draftTimeLimitSeconds, setDraftTimeLimitSeconds] = useState('')
  const [draftTimeLimitSource, setDraftTimeLimitSource] = useState<'untimed' | 'section_full' | 'section_auto' | 'custom'>('custom')
  const [draftTimeLimitSpeed, setDraftTimeLimitSpeed] = useState(1)
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
    const sec = current.time_limit_seconds ?? 0
    setDraftIsTimed(sec > 0)
    setDraftTimeLimitMinutes(String(Math.floor(sec / 60)))
    setDraftTimeLimitSeconds(String(Math.floor(sec % 60)))
    setDraftTimeLimitSource(sec > 0 ? 'custom' : 'untimed')
    setDraftTimeLimitSpeed(1)
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
      isPrivate: draftPrivate,
      isStudentGenerated: false,
      stemIds: draftStemIds,
    })
    return isSnapshotDirty(snapshot, baseline)
  }, [baseline, draftName, draftDescription, draftPrivate, draftStemIds, timeLimitSeconds])

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

  const stemsThatWillBecomePublicCount = useMemo(() => {
    if (draftPrivate) return 0
    return draftStemIds.filter(
      (id) => (stemCatalog as UcatStemCatalogItem[]).find((s) => s.id === id)?.isPrivate
    ).length
  }, [draftPrivate, draftStemIds, stemCatalog])

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
        options: filterOptionsWithContent(question.options).map((option, optionIndex) => ({
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
          isPrivate: draftPrivate,
          isStudentGenerated: false,
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
        saveDisabled={!isDirty || !isTimeLimitValid || updateSet.isPending}
        isSaving={updateSet.isPending}
        headerActions={headerActions}
        hideCancel
      >
        {stemsThatWillBecomePublicCount > 0 && (
          <UcatVisibilityCascadeWarning type="set" count={stemsThatWillBecomePublicCount} />
        )}
        <div className="min-h-0 flex-1 overflow-auto">
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
          sections={(sectionsQuery.data ?? []).map((s) => ({
            id: s.id ?? '',
            name: s.name ?? null,
            time_limit_seconds: s.time_limit_seconds ?? null,
            time_per_question: s.time_per_question ?? null,
            number_of_questions: s.number_of_questions ?? null,
          }))}
        />
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
