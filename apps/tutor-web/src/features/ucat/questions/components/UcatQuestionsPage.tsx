'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchableSelect,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TablePagination,
  useToast,
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
import { useCreateUcatSet, useUcatSets, useUpdateUcatSet } from '@/features/ucat/sets/hooks/useUcatSets'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { ucatQuestionsApi } from '@/features/ucat/questions/api/questions'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
import { ucatSetsApi } from '@/features/ucat/sets/api/sets'
import { UcatQuestionStemDialog } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import {
  BulkImportQuestionStemsModal,
  type BulkImportSubmitArgs,
} from '@/features/ucat/questions/components/BulkImportQuestionStemsModal'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import {
  filterOptionsWithContent,
  plainTextToProseMirror,
  proseMirrorToPlainText,
} from '@/features/ucat/shared/lib/rich-text'
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
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
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
  const createSetMutation = useCreateUcatSet()
  const updateSetMutation = useUpdateUcatSet()
  const detail = useUcatQuestionDetail(editingStemId)
  const setsList = (setsQuery.data ?? []).filter(
    (s) =>
      !(s as { deleted_at?: string | null }).deleted_at &&
      !(s as { is_student_generated?: boolean }).is_student_generated
  )
  const setIdsForDetail = useMemo(
    () => (addToSetsPopoverOpen && selectedStemIds.size > 0 ? setsList.map((s) => s.id ?? '').filter(Boolean) : []),
    [addToSetsPopoverOpen, selectedStemIds.size, setsList]
  )
  const setDetailQueries = useQueries({
    queries: setIdsForDetail.map((setId) => ({
      queryKey: ucatKeys.set(setId),
      queryFn: () => ucatSetsApi.detail(setId),
      enabled: true,
    })),
  })
  const setDetailsMap = useMemo(() => {
    const m: Record<string, { stems: Array<{ stem_id: string }> } | null> = {}
    setIdsForDetail.forEach((setId, i) => {
      const data = setDetailQueries[i]?.data
      const stems = (data?.stems as Array<{ stem_id: string }> | null) ?? null
      m[setId] = stems ? { stems } : null
    })
    return m
  }, [setIdsForDetail, setDetailQueries])
  const selectedStemIdsArray = useMemo(() => Array.from(selectedStemIds), [selectedStemIds])
  const selectedSize = selectedStemIds.size
  const setInCountMap = useMemo(() => {
    const map: Record<string, number> = {}
    setsList.forEach((s) => {
      const setId = s.id ?? ''
      const stems = setDetailsMap[setId]?.stems ?? []
      const stemIdSet = new Set(stems.map((x) => x.stem_id))
      map[setId] = selectedStemIdsArray.filter((id) => stemIdSet.has(id)).length
    })
    return map
  }, [setsList, setDetailsMap, selectedStemIdsArray])
  const stemsAlreadyInSelectedSetsCount = useMemo(() => {
    if (bulkSetIds.length === 0) return 0
    const inAny = new Set<string>()
    bulkSetIds.forEach((setId) => {
      const stems = setDetailsMap[setId]?.stems ?? []
      stems.forEach((s) => inAny.add(s.stem_id))
    })
    return selectedStemIdsArray.filter((id) => inAny.has(id)).length
  }, [bulkSetIds, setDetailsMap, selectedStemIdsArray])
  const setDetailsReady =
    setDetailQueries.length > 0 && setDetailQueries.every((q) => q.isFetched)
  const addToSetsPreTickedRef = useRef(false)
  useEffect(() => {
    if (!addToSetsPopoverOpen) {
      addToSetsPreTickedRef.current = false
      return
    }
    if (selectedSize === 0 || setIdsForDetail.length === 0 || !setDetailsReady) return
    if (addToSetsPreTickedRef.current) return
    addToSetsPreTickedRef.current = true
    const allInSetIds = setsList
      .map((s) => s.id ?? '')
      .filter((setId) => setInCountMap[setId] === selectedSize)
    if (allInSetIds.length === 0) return
    setBulkSetIds((prev) => {
      const next = new Set(prev)
      allInSetIds.forEach((id) => next.add(id))
      return Array.from(next)
    })
  }, [addToSetsPopoverOpen, selectedSize, setIdsForDetail.length, setDetailsReady, setsList, setInCountMap])

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

  const visible = (key: string) => tableState.state.visibleColumns.includes(key)
  const colCount =
    2 + // checkbox, expand
    (visible('section_name') ? 1 : 0) +
    (visible('category_name') ? 1 : 0) +
    (visible('stem_text') ? 1 : 0) +
    (visible('question_count') ? 1 : 0) +
    (visible('sets') ? 1 : 0) +
    (visible('visibility') ? 1 : 0) +
    (visible('type_summary') ? 1 : 0) +
    (visible('actions') ? 1 : 0)

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

  function toExplanationNull(value: unknown): import('@altitutor/shared').Json | null {
    if (value == null) return null
    if (typeof value === 'string' && value === 'null') return null
    return value as import('@altitutor/shared').Json
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
        answerExplanation: toExplanationNull(question.answerExplanation),
        difficulty: question.difficulty,
        timeBurdenSeconds: parseTimeToSeconds(question.timeBurdenSeconds ?? '') ?? null,
        tagIds: question.tagIds ?? [],
        options: filterOptionsWithContent(question.options).map((option, optionIndex) => ({
          index: optionIndex + 1,
          answerText: option.answerText,
          answerExplanation: toExplanationNull(option.answerExplanation),
          isAnswer: option.isAnswer,
        })),
      })),
    }
  }

  async function handleCreate(payload: UcatQuestionStemFormValues) {
    const mapped = mapFormValuesToBundlePayload(payload)
    const result = await createMutation.mutateAsync(mapped)
    setCreateOpen(false)
    const questionCount = payload.questions?.length ?? 0
    toast({
      title: `${questionCount} question${questionCount === 1 ? '' : 's'} created`,
      description: (
        <button
          type="button"
          onClick={() => setEditingStemId(result.id)}
          className="underline font-medium hover:no-underline text-left"
        >
          View questions
        </button>
      ),
    })
  }

  async function handleUpdate(payload: UcatQuestionStemFormValues) {
    if (!editingStemId) return

    const mapped = mapFormValuesToBundlePayload(payload, editingStemId)
    await updateMutation.mutateAsync({ stemId: editingStemId, payload: mapped })
    setEditingStemId(null)
  }

  async function handleBulkImportSubmit(args: BulkImportSubmitArgs) {
    const stemsPayload = args.stems.map((form) => mapFormValuesToBundlePayload(form))
    const { ids } = await bulkImportMutation.mutateAsync({
      sectionId: args.sectionId,
      stems: stemsPayload,
    })

    const questionCount = stemsPayload.reduce((sum, s) => sum + (s.questions?.length ?? 0), 0)
    let targetSetId: string | null = null
    let targetSetName: string | null = null

    if (args.addToSet && ids.length > 0) {
      if (args.addToSet.mode === 'create') {
        const { id } = await createSetMutation.mutateAsync({
          name: plainTextToProseMirror(args.addToSet.name),
          description: args.addToSet.description,
          timeLimitSeconds: args.addToSet.timeLimitSeconds,
          isPrivate: args.addToSet.isPrivate,
          isStudentGenerated: false,
          stemIds: ids,
        })
        await queryClient.invalidateQueries({ queryKey: ucatKeys.set(id) })
        targetSetId = id
        targetSetName = args.addToSet.name.trim() || 'Untitled'
      } else {
        const setDetail = await ucatSetsApi.detail(args.addToSet.setId)
        if (setDetail) {
          const stems = (setDetail.stems as Array<{ stem_id: string }> | null) ?? []
          const currentIds = stems.map((s) => s.stem_id)
          const newStemIds = Array.from(new Set([...currentIds, ...ids]))
          await updateSetMutation.mutateAsync({
            setId: args.addToSet.setId,
            payload: {
              name: setDetail.name ?? plainTextToProseMirror(''),
              description: proseMirrorToPlainText(setDetail.description ?? null) ?? '',
              timeLimitSeconds: setDetail.time_limit_seconds ?? null,
              isPrivate: !!setDetail.is_private,
              isStudentGenerated: !!(setDetail as { is_student_generated?: boolean }).is_student_generated,
              stemIds: newStemIds,
            },
          })
          targetSetId = args.addToSet.setId
          targetSetName = proseMirrorToPlainText(setDetail.name ?? null) || 'Untitled'
        }
      }
    }

    setBulkImportOpen(false)

    if (targetSetId && targetSetName) {
      toast({
        title: `${questionCount} question${questionCount === 1 ? '' : 's'} imported and added to set ${targetSetName}`,
        description: (
          <button
            type="button"
            onClick={() => setEditingSetId(targetSetId)}
            className="underline font-medium hover:no-underline text-left"
          >
            View set
          </button>
        ),
      })
    } else {
      toast({
        title: `${questionCount} question${questionCount === 1 ? '' : 's'} imported`,
      })
    }
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

  const { toast } = useToast()
  async function handleBulkDeleteConfirm() {
    const ids = Array.from(selectedStemIds)
    setBulkDeletePending(true)
    try {
      await ucatQuestionsApi.bulkRemove(ids)
      await queryClient.invalidateQueries({ queryKey: ucatKeys.questions() })
      setBulkDeleteOpen(false)
      setSelectedStemIds(new Set())
    } catch (err) {
      toast({
        title: 'Cannot delete',
        description: err instanceof Error ? err.message : 'Failed to delete question stems.',
        variant: 'destructive',
      })
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
              {visible('section_name') && <TableHead>Section</TableHead>}
              {visible('category_name') && <TableHead>Category</TableHead>}
              {visible('stem_text') && <TableHead>Stem text</TableHead>}
              {visible('question_count') && <TableHead>Questions</TableHead>}
              {visible('sets') && <TableHead>Sets</TableHead>}
              {visible('visibility') && <TableHead>Visibility</TableHead>}
              {visible('type_summary') && <TableHead>Type</TableHead>}
              {visible('actions') && <TableHead className="w-16 shrink-0" />}
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
                    {visible('section_name') && <TableCell>{row.section_name}</TableCell>}
                    {visible('category_name') && <TableCell>{row.category_name ?? '-'}</TableCell>}
                    {visible('stem_text') && (
                      <TableCell className="max-w-[200px]" title={row.stem_text}>
                        {truncate(row.stem_text, 80)}
                      </TableCell>
                    )}
                    {visible('question_count') && <TableCell>{row.question_count}</TableCell>}
                    {visible('sets') && (
                      <TableCell className="max-w-[180px]" title={row.set_names}>
                        {truncate(row.set_names, 50)}
                      </TableCell>
                    )}
                    {visible('visibility') && (
                      <TableCell>{row.is_private ? 'Private' : 'Public'}</TableCell>
                    )}
                    {visible('type_summary') && <TableCell>{row.type_summary}</TableCell>}
                    {visible('actions') && (
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
                    )}
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
        <SearchableSelect<{ id: string | null; name: string | null }>
          items={categories.data ?? []}
          value={null}
          onValueChange={(c) => {
            if (c?.id) {
              setBulkCategoryId(c.id)
              setBulkCategoryOpen(true)
            }
          }}
          getItemId={(c) => c.id ?? ''}
          getItemLabel={(c) => c.name ?? 'Untitled'}
          getItemValue={(c) => c.name ?? ''}
          placeholder="Category"
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
          trigger={
            <Button variant="outline" size="sm">
              Category
            </Button>
          }
          contentWidth="240px"
          align="start"
          side="top"
        />
        <SearchableSelect<{ value: boolean; label: string }>
          items={[
            { value: false, label: 'Public' },
            { value: true, label: 'Private' },
          ]}
          value={null}
          onValueChange={(item) => {
            if (item) {
              setBulkVisibilityPrivate(item.value);
              setBulkVisibilityOpen(true);
            }
          }}
          getItemId={(i) => (i.value ? 'private' : 'public')}
          getItemLabel={(i) => i.label}
          placeholder="Visibility"
          searchPlaceholder="Search..."
          emptyMessage="No options"
          trigger={
            <Button variant="outline" size="sm">
              Visibility
            </Button>
          }
          contentWidth="160px"
          align="start"
          side="top"
        />
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
                    const inCount = setInCountMap[setId] ?? 0
                    const checkboxState =
                      isSelected ? true : inCount === selectedSize ? true : inCount > 0 ? 'indeterminate' : false
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
                        <Checkbox checked={checkboxState} />
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
              {stemsAlreadyInSelectedSetsCount > 0 && (
                <> {stemsAlreadyInSelectedSetsCount} of the stems are already in one or more of the set(s).</>
              )}
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
        onEditSet={(setId) => setEditingSetId(setId)}
      />

      <UcatSetEditorDialog
        open={!!editingSetId}
        setId={editingSetId}
        onClose={() => setEditingSetId(null)}
      />
    </div>
  )
}
