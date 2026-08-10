'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import Link from 'next/link'
import { Button, useToast } from '@altitutor/ui'
import { useUcatSetDetail, useUpdateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import {
  plainTextToProseMirror,
  proseMirrorToPlainText,
} from '@/features/ucat/shared/lib/rich-text'
import { isSnapshotDirty, snapshotSetDetail } from '@/features/ucat/shared/lib/dirty-state'
import { minutesSecondsToTotal } from '@/features/ucat/shared/lib/time-utils'
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
import { buildStemCatalogFilterDefinitions, buildStemCatalogSetFilterOptions } from '@/features/ucat/shared/lib/stem-catalog-filters'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import { UcatPageHeader, UcatPageSkeleton, UcatAccessDenied } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { parseUcatVisibilityError } from '@/features/ucat/shared/lib/visibility-error'
import { UcatSetEditorContent } from '@/features/ucat/sets/components/UcatSetEditorContent'
import { UcatRichTextFloatingToolbar } from '@/features/ucat/shared/components/UcatRichTextFloatingToolbar'
import { useUcatMockBlueprints } from '@/features/ucat/mocks/hooks/useUcatMocks'
import {
  parseLinkedMockBlueprintCompliance,
  recalculateLinkedMockBlueprintCompliance,
} from '@/features/ucat/mocks/lib/blueprint-compliance'
import { parseSetSections } from '@/features/ucat/shared/lib/set-section-status'

/** Shape of each stem in vtutor_ucat_question_set_detail.stems (from DB view) */
type SetDetailStem = { stem_id: string; stem_text?: unknown; questions_meta?: Array<{ id: string; index: number }> }

type UcatSetDetailPageProps = {
  setId: string
}

export function UcatSetDetailPage({ setId }: UcatSetDetailPageProps) {
  const { toast } = useToast()
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

  const linkedBlueprintReports = useMemo(() => recalculateLinkedMockBlueprintCompliance({
    linkedReports: storedLinkedBlueprintReports,
    blueprints: blueprintsQuery.data ?? [],
    setCatalog: (setsQuery.data ?? []).map(set => {
      const parsed = parseSetSections(set.sections ?? null)
      return {
        id: set.id ?? '',
        name: proseMirrorToPlainText(set.name ?? null) || 'Untitled',
        sectionDisplay: '',
        sectionCount: parsed.sectionCount,
        firstSectionNumber: parsed.firstSectionNumber,
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
      sectionNumbers: setSectionsFromStems.flatMap(draftSection => {
        const sectionNumber = (sectionsQuery.data ?? []).find(section => section.id === draftSection.sectionId)?.section_number
        return sectionNumber == null ? [] : [sectionNumber]
      }),
    },
  }), [
    blueprintsQuery.data,
    draftStemIds,
    sectionsQuery.data,
    setSectionsFromStems,
    setId,
    setsQuery.data,
    stemCatalog,
    storedLinkedBlueprintReports,
    timeLimitSeconds,
  ])

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

    const mapped = formValuesToStemBundlePayload(payload, editingStemId)

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
          <Button onClick={save} disabled={!isDirty || !isTimeLimitValid || updateSet.isPending}>
            {updateSet.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        }
      />

      <div className={cn('relative mt-4 flex h-[70vh] min-h-0 flex-col', tutorTableShell)}>
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
          stemCatalog={stemCatalog as unknown as UcatStemCatalogItem[]}
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
          linkedBlueprintReports={linkedBlueprintReports}
          sections={(sectionsQuery.data ?? []).map((s) => ({
            id: s.id ?? '',
            name: s.name ?? null,
            time_limit_seconds: s.time_limit_seconds ?? null,
            time_per_question: s.time_per_question ?? null,
            number_of_questions: s.number_of_questions ?? null,
          }))}
        />
        <UcatRichTextFloatingToolbar editor={activeTextEditor} />
      </div>

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
    </div>
  )
}
