'use client'

import React, { useMemo, useState } from 'react'
import { useQueryClient, useQueries } from '@tanstack/react-query'
import type { DataTableColumnDefinition, DataTableFilterDefinition, DataTableSortOption } from '@altitutor/shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Checkbox,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  DataTableToolbar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
} from '@altitutor/ui'
import { ChevronDown, ChevronRight, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import {
  useBulkImportUcatQuestionStems,
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
import { useUcatSets, useUpdateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import { UcatQuestionStemDialog } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { BulkImportQuestionStemsModal } from '@/features/ucat/questions/components/BulkImportQuestionStemsModal'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { plainTextToProseMirror, proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { formatSecondsToDuration, parseTimeToSeconds } from '@/features/ucat/shared/lib/time-utils'
import type { UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { applyBooleanTextFilter, applySingleSelectFilter, applySort, useUcatTableState } from '@/features/ucat/shared/hooks/useUcatTableState'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatSelectionToolbar } from '@/features/ucat/shared/selection-toolbar'
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
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [editingStemId, setEditingStemId] = useState<string | null>(null)
  const [deletingStemId, setDeletingStemId] = useState<string | null>(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [expandedStemIds, setExpandedStemIds] = useState<Set<string>>(new Set())
  const [expandedQuestionKeys, setExpandedQuestionKeys] = useState<Set<string>>(new Set())
  const [selectedStemIds, setSelectedStemIds] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false)
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null)
  const [bulkVisibilityOpen, setBulkVisibilityOpen] = useState(false)
  const [bulkVisibilityPrivate, setBulkVisibilityPrivate] = useState<boolean | null>(null)
  const [bulkSetsOpen, setBulkSetsOpen] = useState(false)
  const [bulkSetIds, setBulkSetIds] = useState<string[]>([])
  const [addToSetsPopoverOpen, setAddToSetsPopoverOpen] = useState(false)
  const [bulkCategoryPending, setBulkCategoryPending] = useState(false)
  const [bulkVisibilityPending, setBulkVisibilityPending] = useState(false)
  const [bulkSetsPending, setBulkSetsPending] = useState(false)
  const [bulkDeletePending, setBulkDeletePending] = useState(false)
  const selectionMode = selectedStemIds.size > 0

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
  const queryClient = useQueryClient()
  const setsQuery = useUcatSets()
  const updateSetMutation = useUpdateUcatSet()
  const detail = useUcatQuestionDetail(editingStemId)
  const setsList = (setsQuery.data ?? []).filter(
    (s) => !(s as { deleted_at?: string | null }).deleted_at
  )

  const createMutation = useCreateUcatQuestionStem()
  const updateMutation = useUpdateUcatQuestionStem()
  const deleteMutation = useDeleteUcatQuestionStem()
  const restoreMutation = useRestoreUcatQuestionStem()
  const bulkImportMutation = useBulkImportUcatQuestionStems()

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

  const { page, pageSize } = tableState.state
  const totalRows = sortedRows.length
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const effectivePage = Math.min(page, pageCount)
  const paginatedRows = useMemo(() => {
    const start = (effectivePage - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, effectivePage, pageSize])

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
  const colCount = 8 + (showTypeCol ? 1 : 0) + (showSetsCol ? 1 : 0) // checkbox, expand, section, category, stem, questions, [sets], visibility, [type], actions

  const allVisibleSelected = paginatedRows.length > 0 && paginatedRows.every((r) => selectedStemIds.has(r.id))
  const someVisibleSelected = paginatedRows.some((r) => selectedStemIds.has(r.id))

  function toggleStemSelection(id: string) {
    setSelectedStemIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAllVisible() {
    if (allVisibleSelected) {
      setSelectedStemIds((prev) => {
        const next = new Set(prev)
        paginatedRows.forEach((r) => next.delete(r.id))
        return next
      })
    } else {
      setSelectedStemIds((prev) => new Set([...prev, ...paginatedRows.map((r) => r.id)]))
    }
  }

  function stemDetailToBundlePayload(
    detail: StemDetailRow,
    overrides: { categoryId?: string | null; isPrivate?: boolean }
  ): UcatQuestionStemBundlePayload {
    const EMPTY_DOC = plainTextToProseMirror('')
    const questions: UcatQuestionStemBundlePayload['questions'] = (detail.questions ?? []).map((q) => ({
      index: q.index,
      questionText: (q.question_text ?? EMPTY_DOC) as import('@altitutor/shared').Json,
      questionType: q.question_type,
      answerExplanation: (q.answer_explanation ?? null) as import('@altitutor/shared').Json | null,
      difficulty: q.difficulty,
      timeBurdenSeconds: q.time_burden_seconds ?? null,
      tagIds: (q.tags ?? []).map((t) => t.id),
      options: (q.answer_options ?? []).map((opt, i) => ({
        index: i + 1,
        answerText: (opt.answer_text ?? EMPTY_DOC) as import('@altitutor/shared').Json,
        answerExplanation: (opt.answer_explanation ?? null) as import('@altitutor/shared').Json | null,
        isAnswer: opt.is_answer,
        imageFileId: opt.image_file_id ?? null,
      })),
    }))
    return {
      sectionId: detail.section_id,
      categoryId: overrides.categoryId ?? detail.question_stem_category_id ?? null,
      stemText: (detail.stem_text ?? EMPTY_DOC) as import('@altitutor/shared').Json,
      isPrivate: overrides.isPrivate ?? detail.is_private,
      questions,
    }
  }

  function mapFormValuesToBundlePayload(
    payload: UcatQuestionStemFormValues,
    stemId?: string | null
  ): UcatQuestionStemBundlePayload {
    return {
      stemId: stemId ?? undefined,
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
          answerExplanation: option.answerExplanation ?? null,
          isAnswer: option.isAnswer,
          imageFileId: option.imageFileId ?? null,
        })),
      })),
    }
  }

  async function handleCreate(payload: UcatQuestionStemFormValues) {
    const mapped = mapFormValuesToBundlePayload(payload)
    await createMutation.mutateAsync(mapped)
    setCreateOpen(false)
  }

  async function handleUpdate(payload: UcatQuestionStemFormValues) {
    if (!editingStemId) return

    const mapped = mapFormValuesToBundlePayload(payload, editingStemId)
    await updateMutation.mutateAsync({ stemId: editingStemId, payload: mapped })
    setEditingStemId(null)
  }

  async function handleBulkImportSubmit(args: {
    sectionId: string
    stems: UcatQuestionStemFormValues[]
  }) {
    const stemsPayload = args.stems.map((form) => mapFormValuesToBundlePayload(form))
    await bulkImportMutation.mutateAsync({ sectionId: args.sectionId, stems: stemsPayload })
    setBulkImportOpen(false)
  }

  async function handleBulkCategoryConfirm() {
    if (bulkCategoryId == null) return
    setBulkCategoryPending(true)
    try {
      await ucatQuestionsApi.bulkUpdateMetadata(Array.from(selectedStemIds), { categoryId: bulkCategoryId })
      await queryClient.invalidateQueries({ queryKey: ucatKeys.questions() })
      setBulkCategoryOpen(false)
      setBulkCategoryId(null)
      setSelectedStemIds(new Set())
    } finally {
      setBulkCategoryPending(false)
    }
  }

  async function handleBulkVisibilityConfirm() {
    if (bulkVisibilityPrivate == null) return
    setBulkVisibilityPending(true)
    try {
      await ucatQuestionsApi.bulkUpdateMetadata(Array.from(selectedStemIds), { isPrivate: bulkVisibilityPrivate })
      await queryClient.invalidateQueries({ queryKey: ucatKeys.questions() })
      setBulkVisibilityOpen(false)
      setBulkVisibilityPrivate(null)
      setSelectedStemIds(new Set())
    } finally {
      setBulkVisibilityPending(false)
    }
  }

  async function handleBulkSetsConfirm() {
    if (bulkSetIds.length === 0) return
    setBulkSetsPending(true)
    try {
      const stemIds = Array.from(selectedStemIds)
      await Promise.all(
        bulkSetIds.map(async (setId) => {
          const setDetail = await ucatSetsApi.detail(setId)
          if (!setDetail) return
          const stems = (setDetail.stems as Array<{ stem_id: string }> | null) ?? []
          const currentIds = stems.map((s) => s.stem_id)
          const newStemIds = Array.from(new Set([...currentIds, ...stemIds]))
          await updateSetMutation.mutateAsync({
            setId,
            payload: {
              name: setDetail.name ?? plainTextToProseMirror(''),
              description: proseMirrorToPlainText(setDetail.description ?? null) ?? '',
              timeLimitSeconds: setDetail.time_limit_seconds ?? null,
              isPrivate: !!setDetail.is_private,
              isStudentGenerated: !!(setDetail as { is_student_generated?: boolean }).is_student_generated,
              stemIds: newStemIds,
            },
          })
        })
      )
      setBulkSetsOpen(false)
      setBulkSetIds([])
      setSelectedStemIds(new Set())
      await queryClient.invalidateQueries({ queryKey: ucatKeys.questions() })
      await queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
    } finally {
      setBulkSetsPending(false)
    }
  }

  async function handleBulkDeleteConfirm() {
    const ids = Array.from(selectedStemIds)
    setBulkDeletePending(true)
    try {
      await ucatQuestionsApi.bulkRemove(ids)
      await queryClient.invalidateQueries({ queryKey: ucatKeys.questions() })
      setBulkDeleteOpen(false)
      setSelectedStemIds(new Set())
    } finally {
      setBulkDeletePending(false)
    }
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
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
              Bulk Import
            </Button>
            <Button onClick={() => setCreateOpen(true)}>Add Question Stem</Button>
          </div>
        }
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

      <div className={cn('pt-3', selectionMode && 'pb-24')}>
        <div className="rounded-md border">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleSelectAllVisible}
                  aria-label="Select all visible rows"
                />
              </TableHead>
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
            {paginatedRows.map((row) => {
              const isStemExpanded = expandedStemIds.has(row.id)
              const detail = detailsMap[row.id]
              const hasQuestions = (row.question_count ?? 0) > 0
              return (
                <React.Fragment key={row.id}>
                  <TableRow
                    className={cn(
                      row.deleted_at && 'bg-destructive/10',
                      selectedStemIds.has(row.id) && 'bg-muted/50'
                    )}
                    onClick={() => selectionMode && toggleStemSelection(row.id)}
                  >
                    <TableCell className="w-12" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedStemIds.has(row.id)}
                        onCheckedChange={() => toggleStemSelection(row.id)}
                        aria-label={`Select ${row.id}`}
                      />
                    </TableCell>
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
                    <TableCell className="w-16 shrink-0" onClick={(e) => e.stopPropagation()}>
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
        <TablePagination
          page={effectivePage}
          pageSize={pageSize}
          total={totalRows}
          onPageChange={tableState.actions.onPageChange}
          onPageSizeChange={tableState.actions.onPageSizeChange}
          pageSizeOptions={[10, 20, 50]}
          className="pt-3"
        />
      </div>

      <UcatSelectionToolbar
        selectedCount={selectedStemIds.size}
        onCancel={() => setSelectedStemIds(new Set())}
        onDelete={() => setBulkDeleteOpen(true)}
        deletePending={deleteMutation.isPending}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Category
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="max-h-[300px] overflow-y-auto">
            {(categories.data ?? []).map((c) => (
              <DropdownMenuItem
                key={c.id ?? ''}
                onClick={() => {
                  setBulkCategoryId(c.id ?? null)
                  setBulkCategoryOpen(true)
                }}
              >
                {c.name ?? 'Untitled'}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              Visibility
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuItem onClick={() => { setBulkVisibilityPrivate(false); setBulkVisibilityOpen(true) }}>
              Public
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setBulkVisibilityPrivate(true); setBulkVisibilityOpen(true) }}>
              Private
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Popover open={addToSetsPopoverOpen} onOpenChange={setAddToSetsPopoverOpen}>
          <PopoverTrigger
            type="button"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border h-9 px-3 hover:bg-brand-lightBlue/10 text-brand-darkBlue dark:border-brand-dark-border dark:text-white dark:hover:bg-brand-dark-card/70 dark:hover:text-white"
          >
            Add to sets
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start" side="top">
            <Command>
              <CommandInput placeholder="Search sets..." />
              <CommandList>
                <CommandEmpty>No sets found.</CommandEmpty>
                <CommandGroup>
                  {setsList.map((set) => {
                    const setId = set.id ?? ''
                    const isSelected = bulkSetIds.includes(setId)
                    return (
                      <CommandItem
                        key={setId}
                        value={`${setId}-${proseMirrorToPlainText(set.name ?? null)}`}
                        onSelect={() => {
                          setBulkSetIds((prev) =>
                            isSelected ? prev.filter((id) => id !== setId) : [...prev, setId]
                          )
                        }}
                        className="flex items-center gap-2 text-brand-darkBlue dark:text-white data-[disabled]:opacity-100 data-[disabled]:pointer-events-auto aria-selected:bg-muted aria-selected:text-brand-darkBlue dark:aria-selected:bg-muted/50 dark:aria-selected:text-white hover:bg-muted dark:hover:bg-muted/50"
                      >
                        <Checkbox checked={isSelected} />
                        <span>{proseMirrorToPlainText(set.name ?? null) || 'Untitled'}</span>
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
            <div className="border-t p-2">
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={() => {
                  setAddToSetsPopoverOpen(false)
                  setBulkSetsOpen(true)
                }}
                disabled={bulkSetIds.length === 0}
              >
                Add to {bulkSetIds.length} set(s)
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </UcatSelectionToolbar>

      <AlertDialog open={bulkCategoryOpen} onOpenChange={setBulkCategoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set category for {selectedStemIds.size} stem(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Category will be set to &quot;{(categories.data ?? []).find((c) => c.id === bulkCategoryId)?.name ?? ''}&quot; for all selected stems.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkCategoryPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBulkCategoryConfirm()} disabled={bulkCategoryPending}>
              {bulkCategoryPending ? 'Updating...' : 'Yes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={bulkVisibilityOpen} onOpenChange={setBulkVisibilityOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set visibility for {selectedStemIds.size} stem(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Visibility will be set to {bulkVisibilityPrivate ? 'Private' : 'Public'} for all selected stems.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkVisibilityPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBulkVisibilityConfirm()} disabled={bulkVisibilityPending}>
              {bulkVisibilityPending ? 'Updating...' : 'Yes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={bulkSetsOpen} onOpenChange={setBulkSetsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add stems to sets?</AlertDialogTitle>
            <AlertDialogDescription>
              Add {selectedStemIds.size} selected stem(s) to {bulkSetIds.length} set(s)?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkSetsPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleBulkSetsConfirm()} disabled={bulkSetsPending}>
              {bulkSetsPending ? 'Updating...' : 'Yes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UcatDeleteConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title={`Delete ${selectedStemIds.size} question stem(s)?`}
        description="The selected stems will be hidden from students. You can restore them later from the deleted list."
        onConfirm={handleBulkDeleteConfirm}
        isPending={bulkDeletePending}
      />

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
        onDelete={
          editingStemId
            ? () => {
                setDeletingStemId(editingStemId)
              }
            : undefined
        }
      />
      <UcatDeleteConfirmDialog
        open={!!deletingStemId}
        onOpenChange={(open) => !open && setDeletingStemId(null)}
        title="Delete question stem?"
        description="The stem and all its questions will be hidden from students. You can restore them later from the deleted list."
        onConfirm={async () => {
          if (deletingStemId) {
            await deleteMutation.mutateAsync(deletingStemId)
            setEditingStemId((prev) => (prev === deletingStemId ? null : prev))
          }
        }}
        isPending={deleteMutation.isPending}
      />

      <BulkImportQuestionStemsModal
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onSubmit={handleBulkImportSubmit}
      />
    </div>
  )
}
