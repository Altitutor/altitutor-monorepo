'use client'

import React, { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import { Button, DataTableToolbar, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@altitutor/ui'
import { ChevronDown, ChevronRight, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import {
  useCreateUcatQuestionStem,
  useDeleteUcatQuestionStem,
  useRestoreUcatQuestionStem,
  useUcatCategories,
  useUcatQuestionDetail,
  useUcatQuestionStemTypes,
  useUcatQuestions,
  useUcatSections,
  useUcatTags,
  useUpdateUcatQuestionStem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
import { UcatQuestionStemDialog } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { formatSecondsToDuration, parseTimeToSeconds } from '@/features/ucat/shared/lib/time-utils'
import type { UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { applyBooleanTextFilter, applySingleSelectFilter, applySort, useUcatTableState } from '@/features/ucat/shared/hooks/useUcatTableState'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { cn } from '@/shared/utils'

function truncate(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text ?? ''
  return text.slice(0, maxLen) + '...'
}

type QuestionRow = {
  id: string
  section_name: string
  section_id: string | null
  category_name: string | null
  question_stem_category_id: string | null
  question_count: number
  is_private: boolean
  updated_at: string | null
  type_summary: string
  stem_text: string
  set_names: string
  deleted_at: string | null
}

const filterDefinitions: DataTableFilterDefinition[] = [
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

const columnDefinitions: DataTableColumnDefinition[] = [
  { key: 'section_name', label: 'Section', visibleByDefault: true },
  { key: 'category_name', label: 'Category', visibleByDefault: true },
  { key: 'stem_text', label: 'Stem text', visibleByDefault: true },
  { key: 'question_count', label: 'Questions', visibleByDefault: true },
  { key: 'sets', label: 'Sets', visibleByDefault: true },
  { key: 'visibility', label: 'Visibility', visibleByDefault: true },
  { key: 'type_summary', label: 'Type', visibleByDefault: false },
  { key: 'actions', label: 'Actions', visibleByDefault: true },
]

const sortOptions: DataTableSortOption[] = [
  { key: 'section_name', label: 'Section' },
  { key: 'category_name', label: 'Category' },
  { key: 'question_count', label: 'Questions' },
  { key: 'sets', label: 'Sets' },
  { key: 'type_summary', label: 'Type' },
  { key: 'visibility', label: 'Visibility' },
]

export function UcatQuestionsPage() {
  const [createOpen, setCreateOpen] = useState(false)
  const [editingStemId, setEditingStemId] = useState<string | null>(null)
  const [deletingStemId, setDeletingStemId] = useState<string | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [expandedStemIds, setExpandedStemIds] = useState<Set<string>>(new Set())
  const [expandedQuestionKeys, setExpandedQuestionKeys] = useState<Set<string>>(new Set())

  const stemTypesQuery = useUcatQuestionStemTypes()
  const stemTypes = stemTypesQuery.data ?? {}
  const tableState = useUcatTableState(columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key))

  const expandedStemArray = useMemo(() => Array.from(expandedStemIds), [expandedStemIds])
  const detailQueries = useQueries({
    queries: expandedStemArray.map((stemId) => ({
      queryKey: [...ucatKeys.question(stemId), 'detail'],
      queryFn: () => ucatQuestionsApi.getDetail(stemId),
      enabled: true,
    })),
  })
  const detailsMap = useMemo(() => {
    const m: Record<string, StemDetailRow | null> = {}
    detailQueries.forEach((q, i) => {
      if (expandedStemArray[i]) m[expandedStemArray[i]] = q.data ?? null
    })
    return m
  }, [detailQueries, expandedStemArray])

  const access = useUcatAccess()
  const questions = useUcatQuestions()
  const sections = useUcatSections()
  const categories = useUcatCategories()
  const tags = useUcatTags()
  const detail = useUcatQuestionDetail(editingStemId)

  const createMutation = useCreateUcatQuestionStem()
  const updateMutation = useUpdateUcatQuestionStem()
  const deleteMutation = useDeleteUcatQuestionStem()
  const restoreMutation = useRestoreUcatQuestionStem()

  const rows: QuestionRow[] = (questions.data ?? []).map((row) => {
    const summary = row.id ? Array.from(stemTypes[row.id] ?? []).join(', ') : ''
    const setNamesArr = Array.isArray(row.set_names) ? (row.set_names as import('@altitutor/shared').Json[]) : []
    const setsDisplay =
      setNamesArr.length > 0
        ? setNamesArr
            .map((n) => proseMirrorToPlainText(n))
            .filter(Boolean)
            .join(', ') || '—'
        : '—'
    return {
      id: row.id ?? '',
      section_name: row.section_name ?? '-',
      section_id: row.section_id,
      category_name: row.category_name,
      question_stem_category_id: row.question_stem_category_id,
      question_count: row.question_count ?? 0,
      is_private: !!row.is_private,
      updated_at: row.updated_at,
      type_summary: summary || '-',
      stem_text: row.stem_text ? proseMirrorToPlainText(row.stem_text as import('@altitutor/shared').Json) : '',
      set_names: setsDisplay,
      deleted_at: (row as { deleted_at?: string | null }).deleted_at ?? null,
    }
  })

  const filteredRows = useMemo(() => {
    const byDeleted = showDeleted
      ? rows.filter((row) => row.deleted_at != null)
      : rows.filter((row) => row.deleted_at == null)
    const search = tableState.state.search.trim().toLowerCase()

    return byDeleted.filter((row) => {
      const searchHit =
        search.length === 0 ||
        row.stem_text.toLowerCase().includes(search) ||
        row.section_name.toLowerCase().includes(search) ||
        (row.category_name ?? '').toLowerCase().includes(search)

      const sectionHit = applySingleSelectFilter(tableState.state, 'section_id', row.section_id)
      const categoryHit = applySingleSelectFilter(tableState.state, 'question_stem_category_id', row.question_stem_category_id)
      const visibilityHit = applyBooleanTextFilter(tableState.state, 'visibility', row.is_private)

      const typeSelected = (tableState.state.filters.question_type?.[0] as string | undefined) ?? 'all'
      const typeHit =
        typeSelected === 'all' ||
        (typeSelected === 'multiple_choice' && row.type_summary.includes('multiple_choice')) ||
        (typeSelected === 'syllogism' && row.type_summary.includes('syllogism'))

      return searchHit && sectionHit && categoryHit && visibilityHit && typeHit
    })
  }, [rows, tableState.state, showDeleted])

  const sortedRows = useMemo(
    () =>
      applySort(filteredRows, tableState.state.sortBy, tableState.state.sortDirection, {
        section_name: (r) => r.section_name,
        category_name: (r) => r.category_name ?? '',
        stem_text: (r) => r.stem_text,
        question_count: (r) => r.question_count,
        sets: (r) => r.set_names,
        type_summary: (r) => r.type_summary,
        visibility: (r) => (r.is_private ? 'Private' : 'Public'),
      }),
    [filteredRows, tableState.state.sortBy, tableState.state.sortDirection]
  )

  const toggleStemExpanded = (stemId: string) => {
    setExpandedStemIds((prev) => {
      const next = new Set(prev)
      if (next.has(stemId)) next.delete(stemId)
      else next.add(stemId)
      return next
    })
  }

  const toggleQuestionExpanded = (stemId: string, questionId: string) => {
    const key = `${stemId}-${questionId}`
    setExpandedQuestionKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const showTypeCol = tableState.state.visibleColumns.includes('type_summary')
  const showSetsCol = tableState.state.visibleColumns.includes('sets')
  const colCount = 7 + (showTypeCol ? 1 : 0) + (showSetsCol ? 1 : 0) // expand, section, category, stem, questions, [sets], visibility, [type], actions

  async function handleCreate(payload: UcatQuestionStemFormValues) {
    const mapped: UcatQuestionStemBundlePayload = {
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

    await createMutation.mutateAsync(mapped)
    setCreateOpen(false)
  }

  async function handleUpdate(payload: UcatQuestionStemFormValues) {
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

    await updateMutation.mutateAsync({ stemId: editingStemId, payload: mapped })
    setEditingStemId(null)
  }

  if (access.isLoading || questions.isLoading || stemTypesQuery.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  const sectionFilterDefs: DataTableFilterDefinition[] = [
    {
      ...filterDefinitions[0],
      options: (sections.data ?? []).map((s) => ({ label: s.name ?? 'Untitled', value: s.id ?? '' })),
    },
    {
      ...filterDefinitions[1],
      options: (categories.data ?? []).map((c) => ({ label: c.name ?? 'Untitled', value: c.id ?? '' })),
    },
    filterDefinitions[2],
    filterDefinitions[3],
  ]

  return (
    <div className="p-6">
      <UcatPageHeader
        title="UCAT Questions"
        description="Manage question stems and nested questions"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Questions' }]}
        actions={<Button onClick={() => setCreateOpen(true)}>Add Question Stem</Button>}
      />

      <DataTableToolbar
        state={tableState.state}
        onSearchChange={tableState.actions.onSearchChange}
        onFiltersChange={tableState.actions.onFiltersChange}
        onSortChange={tableState.actions.onSortChange}
        onGroupByChange={tableState.actions.onGroupByChange}
        onVisibleColumnsChange={tableState.actions.onVisibleColumnsChange}
        onQuickFilterApply={tableState.actions.onQuickFilterApply}
        onReset={tableState.actions.onReset}
        filterDefinitions={sectionFilterDefs}
        columnDefinitions={columnDefinitions}
        sortOptions={sortOptions}
        searchPlaceholder="Search questions"
        filterFooter={
          <div className="px-2 py-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-center"
              onClick={() => {
                setShowDeleted((prev) => {
                  const next = !prev
                  if (next) {
                    tableState.actions.onFiltersChange({})
                    tableState.actions.onSearchChange('')
                  }
                  return next
                })
              }}
            >
              {showDeleted ? 'Show active only' : 'Show deleted'}
            </Button>
          </div>
        }
        showDeletedActive={showDeleted}
        onClearShowDeleted={() => setShowDeleted(false)}
      />

      <div className="pt-3">
        <div className="rounded-md border">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Section</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Stem text</TableHead>
              <TableHead>Questions</TableHead>
              {showSetsCol && <TableHead>Sets</TableHead>}
              <TableHead>Visibility</TableHead>
              {showTypeCol && <TableHead>Type</TableHead>}
              <TableHead className="w-16 shrink-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => {
              const isStemExpanded = expandedStemIds.has(row.id)
              const detail = detailsMap[row.id]
              const hasQuestions = (row.question_count ?? 0) > 0
              return (
                <React.Fragment key={row.id}>
                  <TableRow className={cn(row.deleted_at && 'bg-destructive/10')}>
                    <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                      {hasQuestions ? (
                        <button
                          type="button"
                          onClick={() => toggleStemExpanded(row.id)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          {isStemExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                      ) : null}
                    </TableCell>
                    <TableCell>{row.section_name}</TableCell>
                    <TableCell>{row.category_name ?? '-'}</TableCell>
                    <TableCell className="max-w-[200px]" title={row.stem_text}>
                      {truncate(row.stem_text, 80)}
                    </TableCell>
                    <TableCell>{row.question_count}</TableCell>
                    {showSetsCol && (
                      <TableCell className="max-w-[180px]" title={row.set_names}>
                        {truncate(row.set_names, 50)}
                      </TableCell>
                    )}
                    <TableCell>{row.is_private ? 'Private' : 'Public'}</TableCell>
                    {showTypeCol && <TableCell>{row.type_summary}</TableCell>}
                    <TableCell className="w-16 shrink-0">
                      <div className="flex justify-end">
                        <UcatRowActions
                          actions={[
                            { label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: () => setEditingStemId(row.id) },
                            ...(showDeleted
                              ? [
                                  {
                                    label: 'Restore',
                                    icon: <RotateCcw className="h-4 w-4" />,
                                    onClick: () => restoreMutation.mutate(row.id),
                                  },
                                ]
                              : [
                                  {
                                    label: 'Delete',
                                    icon: <Trash2 className="h-4 w-4" />,
                                    onClick: () => setDeletingStemId(row.id),
                                    destructive: true,
                                  },
                                ]),
                          ]}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                  {isStemExpanded && detail?.questions && (
                    <TableRow>
                      <TableCell colSpan={colCount} className="bg-muted/30 p-0 align-top w-full">
                        <div className="w-full min-w-0 p-3">
                          <Table className="w-full table-fixed">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12 shrink-0" />
                                <TableHead className="w-16 shrink-0">Index</TableHead>
                                <TableHead className="min-w-0">Question text</TableHead>
                                <TableHead className="w-24 shrink-0">Difficulty</TableHead>
                                <TableHead className="w-24 shrink-0">Time burden</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detail.questions.map((q) => {
                                const qKey = `${row.id}-${q.id}`
                                const isQExpanded = expandedQuestionKeys.has(qKey)
                                const qText = proseMirrorToPlainText(q.question_text)
                                const hasOptions = (q.answer_options?.length ?? 0) > 0
                                return (
                                  <React.Fragment key={q.id}>
                                    <TableRow>
                                      <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                                        {hasOptions ? (
                                          <button
                                            type="button"
                                            onClick={() => toggleQuestionExpanded(row.id, q.id)}
                                            className="p-1 hover:bg-muted rounded"
                                          >
                                            {isQExpanded ? (
                                              <ChevronDown className="h-4 w-4" />
                                            ) : (
                                              <ChevronRight className="h-4 w-4" />
                                            )}
                                          </button>
                                        ) : null}
                                      </TableCell>
                                      <TableCell>{q.index}</TableCell>
                                      <TableCell className="max-w-[240px]" title={qText}>
                                        {truncate(qText, 60)}
                                      </TableCell>
                                      <TableCell>{q.difficulty ?? '-'}</TableCell>
                                      <TableCell>{formatSecondsToDuration(q.time_burden_seconds)}</TableCell>
                                    </TableRow>
                                    {isQExpanded && q.answer_options && q.answer_options.length > 0 && (
                                      <TableRow>
                                        <TableCell colSpan={5} className="bg-muted/20 p-0 align-top w-full">
                                          <div className="w-full min-w-0 p-2 pl-14">
                                            <Table className="w-full table-fixed">
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead className="w-16 shrink-0">Index</TableHead>
                                                  <TableHead className="min-w-0">Answer text</TableHead>
                                                  <TableHead className="min-w-0">Answer explanation</TableHead>
                                                  <TableHead className="w-28 shrink-0">Correct answer</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {q.answer_options.map((opt) => (
                                                  <TableRow key={opt.id}>
                                                    <TableCell>{opt.index}</TableCell>
                                                    <TableCell className="max-w-[200px]" title={proseMirrorToPlainText(opt.answer_text)}>
                                                      {truncate(proseMirrorToPlainText(opt.answer_text), 50)}
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px]" title={proseMirrorToPlainText(opt.answer_explanation)}>
                                                      {truncate(proseMirrorToPlainText(opt.answer_explanation), 50)}
                                                    </TableCell>
                                                    <TableCell>{opt.is_answer ? 'Yes' : 'No'}</TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </React.Fragment>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              )
            })}
          </TableBody>
        </Table>
        </div>
      </div>

      <UcatQuestionStemDialog
        open={createOpen}
        title="Create Question Stem"
        submitLabel="Create"
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        sections={(sections.data ?? []).map((section) => ({ id: section.id, name: section.name }))}
        categories={(categories.data ?? []).map((c) => ({ id: c.id, name: c.name, ucat_section_id: c.ucat_section_id })) as CategoryOption[]}
        tags={(tags.data ?? []).map((t) => ({ id: t.id ?? '', name: t.name ?? '' })) as TagOption[]}
        loading={createMutation.isPending}
      />

      <UcatQuestionStemDialog
        open={!!editingStemId}
        title="Edit Question Stem"
        submitLabel="Save"
        onClose={() => setEditingStemId(null)}
        onSubmit={handleUpdate}
        sections={(sections.data ?? []).map((section) => ({ id: section.id, name: section.name }))}
        categories={(categories.data ?? []).map((c) => ({ id: c.id, name: c.name, ucat_section_id: c.ucat_section_id })) as CategoryOption[]}
        tags={(tags.data ?? []).map((t) => ({ id: t.id ?? '', name: t.name ?? '' })) as TagOption[]}
        initial={detail.data}
        loading={updateMutation.isPending || detail.isLoading}
      />
      <UcatDeleteConfirmDialog
        open={!!deletingStemId}
        onOpenChange={(open) => !open && setDeletingStemId(null)}
        title="Delete question stem?"
        description="The stem and all its questions will be hidden from students. You can restore them later from the deleted list."
        onConfirm={async () => { if (deletingStemId) await deleteMutation.mutateAsync(deletingStemId) }}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
