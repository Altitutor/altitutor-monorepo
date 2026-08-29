'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useQueryClient, useQueries } from '@tanstack/react-query'
import type {
  DataTableFilterDefinition,
  DataTableSortOption,
  Json,
} from '@altitutor/shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Checkbox,
  DataTableToolbar,
  getUcatVisibilityColor,
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
import {
  CheckCircle2,
  Bot,
  ChevronDown,
  ChevronRight,
  Eye,
  FilePenLine,
  ListChecks,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  useBulkImportUcatQuestionStems,
  useCreateUcatQuestionStem,
  useDeleteUcatQuestionStem,
  useRestoreUcatQuestionStem,
  useSetUcatQuestionStemStatus,
  useRequestUcatAiAssessment,
  useUcatCategories,
  useUcatQuestionCatalogAuditRuns,
  useUcatQuestionCatalogCreators,
  useUcatQuestionCatalogPage,
  useUcatQuestionDetail,
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
import { GenerateQuestionStemsModal } from '@/features/ucat/questions/components/generated/GenerateQuestionStemsModal'
import {
  UcatQuestionStemApprovalQueueDialog,
  type UcatApprovalQueueEntry,
} from '@/features/ucat/questions/components/approval-queue/UcatQuestionStemApprovalQueue'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { formatSecondsToDuration } from '@/features/ucat/shared/lib/time-utils'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { formValuesToStemBundlePayload } from '@/features/ucat/questions/lib/stem-editor-form'
import { AuditCatalogFilterMenu } from '@/features/ucat/questions/components/AuditCatalogFilterMenu'
import {
  auditMembershipChipClassName,
  auditMembershipChipLabel,
  buildAuditCatalogFilterOptions,
} from '@/features/ucat/questions/lib/audit-catalog'
import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { bulkImportSuccessSummary } from '@/features/ucat/questions/lib/bulk-import-success-summary'
import {
  buildTaxonomyPathLookup,
  categoriesToTaxonomyNodes,
  mapCategoriesToOptions,
  mapTagsToOptions,
  resolveCategoryPathLabel,
  taxonomyDisplayLabel,
} from '@/features/ucat/shared/lib/taxonomy-paths'
import { useUcatTableUrlState } from '@/features/ucat/shared/hooks/useUcatTableUrlState'
import { useUcatRowSelection } from '@/features/ucat/shared/hooks/useUcatRowSelection'
import { useBackgroundBulkAction } from '@/features/ucat/shared/hooks/useBackgroundBulkAction'
import {
  bulkDeleteProgressToast,
  bulkStatusProgressToast,
  bulkUpdateProgressToast,
  nextBulkActionToastId,
  type BackgroundBulkToast,
} from '@/features/ucat/shared/lib/background-bulk-action'
import {
  countStemsInSets,
  useUcatQuestionsTable,
  type QuestionSearchScope,
} from '@/features/ucat/questions/hooks/useUcatQuestionsTable'
import {
  parseSetStemIds,
  setDetailToUpdatePayload,
} from '@/features/ucat/sets/lib/set-payload-mappers'
import { clearUcatTableUrlParams } from '@/features/ucat/shared/lib/ucat-table-url-state'
import {
  filterCategoriesForSections,
  filterTagsForSections,
} from '@/features/ucat/shared/lib/taxonomy-reparent'
import { resolveSectionIdsFromIdFilter } from '@/features/ucat/shared/lib/taxonomy-section-filter'
import {
  UCAT_FILTER_NO_CATEGORY,
  UCAT_FILTER_NOT_IN_ANY_SET,
  UCAT_FILTER_NOT_IN_PRACTICE_POOL,
  UCAT_FILTER_PRACTICE_POOL,
} from '@/features/ucat/shared/lib/table-filter-sentinel'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatSelectionToolbar } from '@/features/ucat/shared/selection-toolbar'
import { cn, formatDateTime } from '@/shared/utils'
import {
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorTableBodyRow,
  tutorTableHeaderRow,
  tutorTableShell,
  tutorToolbarProps,
} from '@/shared/lib/tutor-visual'
import { SegmentedControl } from '@/shared/components/segmented-control'
import {
  firstUcatBulkStatusFailureError,
  lifecycleErrorToast,
  lifecycleStatusSuccessToast,
  type UcatLifecycleEntityType,
} from '@/features/ucat/shared/lifecycle-errors'
import { stemSourceTooltip } from '@/features/ucat/questions/lib/source-display'
import {
  buildQuestionCatalogQuery,
  CREATED_AT_FROM_FILTER_KEY,
  CREATED_AT_TO_FILTER_KEY,
  QUESTION_COUNT_MAX_FILTER_KEY,
  QUESTION_COUNT_MIN_FILTER_KEY,
} from '@/features/ucat/questions/lib/question-catalog-query'
import { FindSimilarQuestionStemsSubmenu } from '@/features/ucat/questions/components/FindSimilarQuestionStemsSubmenu'
import { CreatedAtDateTimeRangeFilter } from '@/features/ucat/questions/components/CreatedAtDateTimeRangeFilter'
import { QuestionStemIdFilter } from '@/features/ucat/questions/components/QuestionStemIdFilter'
import {
  defaultVisibleColumnKeys,
  QUESTION_STEM_NESTED_ANSWER_COLUMNS,
  QUESTION_STEM_NESTED_QUESTION_COLUMNS,
  QUESTION_STEM_TABLE_COLUMNS,
} from '@/features/ucat/questions/lib/question-stems-table-columns'
import { UcatVisibilityBadge } from '@/features/ucat/shared/components/UcatVisibilityBadge'
import { UcatVisibilityTableHeaderLabel } from '@/features/ucat/shared/components/UcatVisibilityInfoTooltip'
import { getUcatContentStatusTransitionOptions, type UcatContentStatus } from '@/features/ucat/shared/types'
import {
  shouldShowRequestAiReviewAction,
  UCAT_AI_REVIEW_STATUS_COPY,
  UCAT_DURABLE_AI_REVIEW_STATUSES,
} from '@/features/ucat/questions/lib/ai-assessment/review-status'
import { buildQuestionCatalogProvenanceFilters } from '@/features/ucat/questions/lib/question-catalog-provenance-filters'

type QuestionsTab = UcatContentStatus

const questionSearchScopeOptions: Array<{ value: QuestionSearchScope; label: string }> = [
  { value: 'stem_text', label: 'Stem text' },
  { value: 'question_text', label: 'Question text' },
  { value: 'answer_option_text', label: 'Answer options' },
  { value: 'tutor_source_note', label: 'Tutor source note' },
]

const defaultQuestionSearchScopes: QuestionSearchScope[] = [
  'stem_text',
  'question_text',
  'answer_option_text',
  'tutor_source_note',
]

const questionColumnDefinitions = QUESTION_STEM_NESTED_QUESTION_COLUMNS
const answerOptionColumnDefinitions = QUESTION_STEM_NESTED_ANSWER_COLUMNS
const defaultVisibleQuestionColumns = defaultVisibleColumnKeys(questionColumnDefinitions)
const defaultVisibleAnswerOptionColumns = defaultVisibleColumnKeys(answerOptionColumnDefinitions)

function parseQuestionsTab(value: string | null): QuestionsTab {
  return value === 'in_review' || value === 'published' ? value : 'draft'
}

const QUESTIONS_TAB_OPTIONS = [
  { value: 'draft' as const, label: 'Draft' },
  { value: 'in_review' as const, label: 'In review' },
  { value: 'published' as const, label: 'Published' },
]

function truncate(text: string, maxLen: number): string {
  if (!text || text.length <= maxLen) return text ?? ''
  return text.slice(0, maxLen) + '...'
}

const filterDefinitions: DataTableFilterDefinition[] = [
  { key: 'section_id', label: 'Section' },
  { key: 'question_stem_category_id', label: 'Category' },
  { key: 'question_tag_id', label: 'Tag' },
  {
    key: 'question_count',
    label: 'Questions',
    type: 'number-range',
    minKey: QUESTION_COUNT_MIN_FILTER_KEY,
    maxKey: QUESTION_COUNT_MAX_FILTER_KEY,
  },
  {
    key: 'visibility',
    label: 'Visibility',
    options: [
      { label: 'Public', value: 'public' },
      { label: 'Private', value: 'private' },
      { label: 'Practice pool', value: UCAT_FILTER_PRACTICE_POOL },
      { label: 'Not in practice pool', value: UCAT_FILTER_NOT_IN_PRACTICE_POOL },
    ],
  },
  {
    key: 'created_at_range',
    label: 'Created at',
    type: 'date-range',
    fromKey: CREATED_AT_FROM_FILTER_KEY,
    toKey: CREATED_AT_TO_FILTER_KEY,
  },
]

const questionStemIdFilterDefinition: DataTableFilterDefinition = {
  key: 'id',
  label: 'ID',
}

const aiReviewFilterDefinition: DataTableFilterDefinition = {
  key: 'ai_review_status',
  label: 'AI review',
  options: UCAT_DURABLE_AI_REVIEW_STATUSES.map((status) => ({
    label: UCAT_AI_REVIEW_STATUS_COPY[status].shortLabel,
    value: status,
  })),
}

const columnDefinitions = QUESTION_STEM_TABLE_COLUMNS

const sortOptions: DataTableSortOption[] = [
  { key: 'section_name', label: 'Section' },
  { key: 'category_name', label: 'Category' },
  { key: 'question_count', label: 'Questions' },
  { key: 'sets', label: 'Sets' },
  { key: 'type_summary', label: 'Type' },
  { key: 'visibility', label: 'Visibility' },
  { key: 'source', label: 'Source' },
  { key: 'created_at', label: 'Date created' },
  { key: 'status', label: 'Status' },
]

const addQuestionOptions = [
  {
    id: 'manual',
    label: 'Add questions',
    description: 'Create a question bundle manually',
    icon: Plus,
  },
  {
    id: 'ai',
    label: 'AI generate questions',
    description: 'Generate question bundles ready for review',
    icon: Sparkles,
  },
  {
    id: 'bulk',
    label: 'Bulk import questions',
    description: 'Paste and parse multiple question bundles',
    icon: Upload,
  },
] as const

export function UcatQuestionsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeTab = parseQuestionsTab(searchParams.get('tab'))
  const bulkStatusOptions = useMemo(() => getUcatContentStatusTransitionOptions(activeTab), [activeTab])

  const setActiveTab = (tab: QuestionsTab) => {
    const params = new URLSearchParams(searchParams.toString())
    clearUcatTableUrlParams(params)
    if (tab !== 'draft') params.set('tab', tab)
    else params.delete('tab')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }
  const [createOpen, setCreateOpen] = useState(false)
  const [bulkImportOpen, setBulkImportOpen] = useState(false)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [approvalQueueOpen, setApprovalQueueOpen] = useState(false)
  const [reviewQueueEntries, setReviewQueueEntries] = useState<UcatApprovalQueueEntry[]>([])
  const [reviewQueueLoading, setReviewQueueLoading] = useState(false)
  const [editingStemId, setEditingStemId] = useState<string | null>(null)
  const [deletingStemId, setDeletingStemId] = useState<string | null>(null)
  const [expandedStemIds, setExpandedStemIds] = useState<Set<string>>(new Set())
  const [expandedQuestionKeys, setExpandedQuestionKeys] = useState<Set<string>>(new Set())
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false)
  const [bulkCategoryId, setBulkCategoryId] = useState<string | null>(null)
  const [bulkVisibilityOpen, setBulkVisibilityOpen] = useState(false)
  const [bulkVisibilityPrivate, setBulkVisibilityPrivate] = useState<boolean | null>(null)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false)
  const [bulkStatus, setBulkStatus] = useState<UcatContentStatus | null>(null)
  const [singleDeletePending, setSingleDeletePending] = useState(false)
  const [setFilterSearch, setSetFilterSearch] = useState('')
  const [searchScopes, setSearchScopes] = useState<QuestionSearchScope[]>(defaultQuestionSearchScopes)
  const [visibleQuestionColumns, setVisibleQuestionColumns] = useState(defaultVisibleQuestionColumns)
  const [visibleAnswerOptionColumns, setVisibleAnswerOptionColumns] = useState(
    defaultVisibleAnswerOptionColumns,
  )

  const initialVisibleColumns = useMemo(
    () => columnDefinitions.filter((c) => c.visibleByDefault).map((c) => c.key),
    [],
  )
  const availableColumnKeys = useMemo(() => columnDefinitions.map((column) => column.key), [])
  const tableState = useUcatTableUrlState(initialVisibleColumns, {
    syncShowDeleted: true,
    availableColumns: availableColumnKeys,
  })
  const toolbarTableState = tableState.state
  const showDeleted = tableState.showDeleted ?? false
  const setShowDeleted = tableState.setShowDeleted ?? (() => undefined)
  const catalogQuery = useMemo(
    () => buildQuestionCatalogQuery({
      tableState: tableState.state,
      status: activeTab,
      showDeleted,
      searchScopes,
    }),
    [activeTab, searchScopes, showDeleted, tableState.state],
  )

  const previousTabRef = useRef(activeTab)
  const tableActionsRef = useRef(tableState.actions)
  tableActionsRef.current = tableState.actions

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
  const questions = useUcatQuestionCatalogPage(catalogQuery)
  const catalogCreators = useUcatQuestionCatalogCreators()
  const catalogAuditRuns = useUcatQuestionCatalogAuditRuns()
  const sections = useUcatSections()
  const categories = useUcatCategories()
  const tags = useUcatTags()
  const categoryPathLookup = useMemo(
    () => buildTaxonomyPathLookup(categoriesToTaxonomyNodes(categories.data ?? [])),
    [categories.data]
  )
  const categoryOptions = useMemo(
    () => mapCategoriesToOptions(categories.data ?? []) as CategoryOption[],
    [categories.data]
  )
  const tagOptions = useMemo(
    () => mapTagsToOptions(tags.data ?? []) as TagOption[],
    [tags.data]
  )
  const tagLabelsById = useMemo(() => {
    const map = new Map<string, string>()
    for (const tag of tagOptions) {
      if (tag.id) map.set(tag.id, tag.label ?? tag.name)
    }
    return map
  }, [tagOptions])
  const queryClient = useQueryClient()
  const setsQuery = useUcatSets()
  const createSetMutation = useCreateUcatSet()
  const updateSetMutation = useUpdateUcatSet()
  const detail = useUcatQuestionDetail(editingStemId)
  const editingStemStatus = useMemo(() => {
    if (detail.data?.status) return detail.data.status
    return (questions.data?.items ?? []).find((row) => row.id === editingStemId)?.status ?? null
  }, [detail.data?.status, editingStemId, questions.data?.items])
  const editDialogInitialMode = editingStemStatus === 'published' ? 'view' : 'edit'
  const setsList = (setsQuery.data ?? []).filter(
    (s) => !(s as { deleted_at?: string | null }).deleted_at,
  )

  const createMutation = useCreateUcatQuestionStem()
  const updateMutation = useUpdateUcatQuestionStem()
  const deleteMutation = useDeleteUcatQuestionStem()
  const restoreMutation = useRestoreUcatQuestionStem()
  const setStatusMutation = useSetUcatQuestionStemStatus()
  const bulkImportMutation = useBulkImportUcatQuestionStems()
  const requestAiReviewMutation = useRequestUcatAiAssessment()
  const { toast } = useToast()
  const { start: startBackgroundBulk, selectionIsBusy } = useBackgroundBulkAction()

  const { rows } = useUcatQuestionsTable({
    data: questions.data?.items,
    status: activeTab,
    stemTagIds: {},
    questionSearchTexts: undefined,
    categoryPathLookup,
    tableState: tableState.state,
    showDeleted,
    searchScopes,
    serverProcessed: true,
  })

  const createdByFilterOptions = useMemo(() => {
    return (catalogCreators.data ?? []).map((creator) => ({
      value: creator.id,
      label: [creator.first_name, creator.last_name].filter(Boolean).join(' ') || 'Unknown staff',
    }))
  }, [catalogCreators.data])

  const auditFilterDefinition: DataTableFilterDefinition = useMemo(
    () => ({
      key: 'audit',
      label: 'Audit',
      options: buildAuditCatalogFilterOptions(catalogAuditRuns.data ?? []),
    }),
    [catalogAuditRuns.data],
  )

  const { page, pageSize } = tableState.state
  const totalRows = questions.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize))
  const effectivePage = Math.min(page, pageCount)
  const paginatedRows = rows
  const aiReviewEnabled = questions.data?.aiReviewEnabled !== false

  useEffect(() => {
    if (page > pageCount) tableState.actions.onPageChange(pageCount)
  }, [page, pageCount, tableState.actions])

  const {
    selectedIds: selectedStemIds,
    selectedIdsArray: selectedStemIdsArray,
    selectionMode,
    allVisibleSelected,
    someVisibleSelected,
    toggleSelection: toggleStemSelection,
    toggleSelectAllVisible,
    clearSelection,
  } = useUcatRowSelection(paginatedRows)
  const bulkSelectionBusy = selectionIsBusy(selectedStemIds)

  useEffect(() => {
    if (previousTabRef.current === activeTab) return
    previousTabRef.current = activeTab
    // setActiveTab already cleared table URL params; reset local table state to match.
    tableActionsRef.current.onReset()
    clearSelection()
    setExpandedStemIds(new Set())
    setExpandedQuestionKeys(new Set())
  }, [activeTab, clearSelection])

  async function handleViewQuestions() {
    setReviewQueueLoading(true)
    try {
      const ids = await ucatQuestionsApi.listCatalogIds(catalogQuery)
      if (ids.length === 0) {
        toast({
          title: 'No matching question stems',
          description: 'No question stems match the current filters.',
        })
        return
      }
      setReviewQueueEntries(ids.map((stemId) => ({ stemId, mode: 'ai_approval' as const })))
      setApprovalQueueOpen(true)
    } catch (error) {
      toast({
        title: 'Could not open questions',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setReviewQueueLoading(false)
    }
  }

  function openLifecycleEntity(entityType: UcatLifecycleEntityType, entityId: string) {
    if (entityType === 'stem') {
      setEditingStemId(entityId)
      return true
    }
    if (entityType === 'set') {
      setEditingStemId(null)
      setDeletingStemId(null)
      setEditingSetId(entityId)
      return true
    }
    return false
  }

  function changeQuestionStatus(
    stemId: string,
    status: UcatContentStatus,
    previousStatus: UcatContentStatus,
    title: string,
  ) {
    void (async () => {
      try {
        await setStatusMutation.mutateAsync({ stemId, status })
        toast(lifecycleStatusSuccessToast({
          contentLabel: 'Question',
          count: 1,
          status,
          onUndo: () => {
            void ucatQuestionsApi.bulkRestoreStatus([stemId], status, previousStatus)
              .then(async () => {
                await invalidateQuestionsListQueries()
                toast({ title: 'Question status restored' })
              })
              .catch((error) => toast(lifecycleErrorToast(error, 'Could not undo status change', router.push, openLifecycleEntity)))
          },
        }))
      } catch (error) {
        toast(lifecycleErrorToast(error, title, router.push, openLifecycleEntity))
      }
    })()
  }

  async function requestAiReview(stemId: string) {
    try {
      const result = await requestAiReviewMutation.mutateAsync({ stemId })
      const message = result.kind === 'queued'
        ? {
            title: 'AI review queued',
            description: 'The review will continue in the background.',
          }
        : result.kind === 'format_blocked'
          ? {
              title: 'AI review stopped at format checks',
              description: 'Open the AI review panel to see the deterministic issues.',
            }
          : result.kind === 'unavailable'
            ? {
                title: 'AI review unavailable',
                description: 'The review models are not configured.',
              }
            : {
                title: 'AI review already requested',
                description: 'The current content already has a matching review request.',
              }
      toast({
        title: message.title,
        description: message.description,
      })
    } catch (error) {
      toast({
        title: 'Could not request AI review',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    }
  }

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
  const visibleQuestion = (key: string) => visibleQuestionColumns.includes(key)
  const visibleAnswerOption = (key: string) => visibleAnswerOptionColumns.includes(key)

  const questionColCount =
    1 + // expand
    (visibleQuestion('index') ? 1 : 0) +
    (visibleQuestion('question_text') ? 1 : 0) +
    (visibleQuestion('explanation') ? 1 : 0) +
    (visibleQuestion('difficulty') ? 1 : 0) +
    (visibleQuestion('time_burden') ? 1 : 0)

  const columnViewGroups = useMemo(
    () => [
      {
        heading: 'Stem columns',
        columnDefinitions,
        visibleColumns: tableState.state.visibleColumns,
        onVisibleColumnsChange: tableState.actions.onVisibleColumnsChange,
        defaultVisibleColumns: initialVisibleColumns,
      },
      {
        heading: 'Question columns',
        columnDefinitions: questionColumnDefinitions,
        visibleColumns: visibleQuestionColumns,
        onVisibleColumnsChange: setVisibleQuestionColumns,
        defaultVisibleColumns: defaultVisibleQuestionColumns,
      },
      {
        heading: 'Answer option columns',
        columnDefinitions: answerOptionColumnDefinitions,
        visibleColumns: visibleAnswerOptionColumns,
        onVisibleColumnsChange: setVisibleAnswerOptionColumns,
        defaultVisibleColumns: defaultVisibleAnswerOptionColumns,
      },
    ],
    [
      tableState.state.visibleColumns,
      tableState.actions.onVisibleColumnsChange,
      visibleQuestionColumns,
      visibleAnswerOptionColumns,
      initialVisibleColumns,
    ],
  )
  const colCount =
    2 + // checkbox, expand
    (visible('section_category') ? 1 : 0) +
    (visible('stem_text') ? 1 : 0) +
    (visible('question_count') ? 1 : 0) +
    (visible('sets') ? 1 : 0) +
    (visible('visibility') ? 1 : 0) +
    (visible('source') ? 1 : 0) +
    (visible('created_at') ? 1 : 0) +
    (visible('status') ? 1 : 0) +
    (visible('review') ? 1 : 0) +
    (visible('type_summary') ? 1 : 0) +
    (visible('actions') ? 1 : 0)

  async function handleCreate(payload: UcatQuestionStemFormValues, options?: { createMore?: boolean }) {
    const mapped = formValuesToStemBundlePayload(payload)
    const result = await createMutation.mutateAsync(mapped)
    if (!options?.createMore) {
      setCreateOpen(false)
    }
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

    const mapped = formValuesToStemBundlePayload(payload, editingStemId)
    await updateMutation.mutateAsync({
      stemId: editingStemId,
      payload: mapped,
      expectedUpdatedAt: detail.data?.updated_at ?? null,
    })
    setEditingStemId(null)
  }

  async function handleBulkImportSubmit(args: BulkImportSubmitArgs) {
    const stemsPayload = args.stems.map((draft) => ({
      ...formValuesToStemBundlePayload(draft.values, draft.id),
      sourceChannel: 'bulk_import' as const,
      tutorSourceNote: args.tutorSourceNote ?? null,
      importStatus: draft.importStatus,
    }))
    const { ids, statuses } = await bulkImportMutation.mutateAsync({
      sectionId: args.sectionId,
      stems: stemsPayload,
    })

    const questionCount = stemsPayload.reduce((sum, s) => sum + (s.questions?.length ?? 0), 0)
    const importSummary = bulkImportSuccessSummary({ questionCount, statuses })
    let targetSetId: string | null = null
    let targetSetName: string | null = null

    if (args.addToSet && ids.length > 0) {
      if (args.addToSet.mode === 'create') {
        const { id } = await createSetMutation.mutateAsync({
          authoringNote: args.addToSet.authoringNote,
          description: args.addToSet.description,
          timingMode: args.addToSet.timingMode,
          paceMultiplier: args.addToSet.paceMultiplier,
          fixedTimeLimitSeconds: args.addToSet.fixedTimeLimitSeconds,
          setFormat: args.addToSet.setFormat,
          accessScope: args.addToSet.isPrivate ? 'private' : 'public',
          sectionId: args.sectionId,
          referenceBlueprintId: args.addToSet.referenceBlueprintId,
          stemIds: ids,
        })
        await queryClient.invalidateQueries({ queryKey: ucatKeys.set(id) })
        targetSetId = id
        const createdSet = await ucatSetsApi.detail(id)
        targetSetName = createdSet?.display_name
          ?? proseMirrorToPlainText(createdSet?.name ?? null)
          ?? 'new set'
      } else {
        const setDetail = await ucatSetsApi.detail(args.addToSet.setId)
        if (setDetail) {
          const newStemIds = Array.from(new Set([...parseSetStemIds(setDetail.stems), ...ids]))
          await updateSetMutation.mutateAsync({
            setId: args.addToSet.setId,
            payload: setDetailToUpdatePayload(setDetail, { stemIds: newStemIds }),
          })
          targetSetId = args.addToSet.setId
          targetSetName = proseMirrorToPlainText(setDetail.name ?? null) || 'Untitled'
        }
      }
    }

    setBulkImportOpen(false)

    if (targetSetId && targetSetName) {
      toast({
        title: `${importSummary.title} and added to set ${targetSetName}`,
        description: (
          <>
            <p className="mb-1">{importSummary.description}</p>
            <button
              type="button"
              onClick={() => setEditingSetId(targetSetId)}
              className="underline font-medium hover:no-underline text-left"
            >
              View set
            </button>
          </>
        ),
      })
    } else {
      toast({
        title: importSummary.title,
        description: importSummary.description,
      })
    }
  }

  function handleBulkCategoryConfirm() {
    if (bulkCategoryId == null) return
    const ids = Array.from(selectedStemIds)
    const categoryId = bulkCategoryId
    startBackgroundBulk({
      ids,
      toastId: nextBulkActionToastId('category'),
      progress: bulkUpdateProgressToast(ids.length, 'question', 'category'),
      begin: () => {
        setBulkCategoryOpen(false)
        setBulkCategoryId(null)
        clearSelection()
      },
      run: async () => {
        await ucatQuestionsApi.bulkUpdateMetadata(ids, { categoryId })
        await invalidateQuestionsListQueries()
      },
      onSuccess: () => ({ title: ids.length === 1 ? 'Category updated' : `Category updated for ${ids.length} questions` }),
      onError: (error) => ({
        title: 'Could not update category',
        description: error instanceof Error ? error.message : 'Failed to update category.',
        variant: 'destructive',
      }),
    })
  }

  function handleBulkVisibilityConfirm() {
    if (bulkVisibilityPrivate == null) return
    const ids = Array.from(selectedStemIds)
    const accessScope = bulkVisibilityPrivate ? 'private' : 'public'
    startBackgroundBulk({
      ids,
      toastId: nextBulkActionToastId('visibility'),
      progress: bulkUpdateProgressToast(ids.length, 'question', 'visibility'),
      begin: () => {
        setBulkVisibilityOpen(false)
        setBulkVisibilityPrivate(null)
        clearSelection()
      },
      run: async () => {
        await ucatQuestionsApi.bulkUpdateMetadata(ids, { accessScope })
        await invalidateQuestionsListQueries()
      },
      onSuccess: () => ({ title: ids.length === 1 ? 'Visibility updated' : `Visibility updated for ${ids.length} questions` }),
      onError: (error) => lifecycleErrorToast(error, 'Could not update visibility', router.push, openLifecycleEntity),
    })
  }

  function handleBulkStatusConfirm() {
    if (!bulkStatus) return
    const ids = Array.from(selectedStemIds)
    const nextStatus = bulkStatus
    startBackgroundBulk({
      ids,
      toastId: nextBulkActionToastId('status'),
      progress: bulkStatusProgressToast(ids.length, 'question', nextStatus),
      begin: () => {
        setBulkStatusOpen(false)
        setBulkStatus(null)
        clearSelection()
      },
      run: async () => {
        const result = await ucatQuestionsApi.bulkSetStatus(ids, nextStatus)
        await invalidateQuestionsListQueries()
        return result
      },
      onSuccess: (result) => {
        const toasts: BackgroundBulkToast[] = []
        if (result.movedIds.length > 0) {
          toasts.push(lifecycleStatusSuccessToast({
            contentLabel: 'Question',
            count: result.movedIds.length,
            status: nextStatus,
            onUndo: () => {
              void ucatQuestionsApi.bulkRestoreStatus(result.movedIds, nextStatus, activeTab)
                .then(async () => {
                  await invalidateQuestionsListQueries()
                  toast({ title: result.movedIds.length === 1 ? 'Question status restored' : 'Question statuses restored' })
                })
                .catch((error) => toast(lifecycleErrorToast(error, 'Could not undo status change', router.push, openLifecycleEntity)))
            },
          }))
        }
        const failureError = firstUcatBulkStatusFailureError(result)
        if (failureError) {
          const count = result.failures.length
          toasts.push(lifecycleErrorToast(
            failureError,
            count === 1 ? '1 question could not be moved' : `${count} questions could not be moved`,
            router.push,
            openLifecycleEntity,
          ))
        }
        return toasts
      },
      onError: (error) => lifecycleErrorToast(error, 'Cannot move selected questions', router.push, openLifecycleEntity),
    })
  }

  async function invalidateQuestionsListQueries() {
    await queryClient.invalidateQueries({ queryKey: ucatKeys.questions('all') })
  }

  function stemDeleteSuccessToast(stemIds: string[]) {
    const count = stemIds.length
    return {
      title: count === 1 ? 'Question stem deleted' : `${count} question stems deleted`,
      description: 'Tap Undo to restore.',
      duration: 10_000,
      action: {
        label: 'Undo',
        onClick: () => {
          void (async () => {
            try {
              await Promise.all(stemIds.map((id) => restoreMutation.mutateAsync(id)))
              await invalidateQuestionsListQueries()
              toast({
                title: count === 1 ? 'Question stem restored' : `${count} question stems restored`,
              })
            } catch (err) {
              toast({
                title: 'Could not undo',
                description: err instanceof Error ? err.message : 'Failed to restore question stems.',
                variant: 'destructive' as const,
              })
            }
          })()
        },
      },
    }
  }

  async function deleteStems(stemIds: string[]) {
    if (stemIds.length === 1) {
      await deleteMutation.mutateAsync(stemIds[0])
    } else {
      await ucatQuestionsApi.bulkRemove(stemIds)
    }
    await invalidateQuestionsListQueries()
    await queryClient.invalidateQueries({ queryKey: ucatKeys.sets() })
    stemIds.forEach((stemId) => {
      const row = rows.find((r) => r.id === stemId)
      row?.set_ids.forEach((setId) => {
        void queryClient.invalidateQueries({ queryKey: ucatKeys.set(setId) })
      })
    })
  }

  async function deleteStemsWithToast(stemIds: string[]) {
    await deleteStems(stemIds)
    toast(stemDeleteSuccessToast(stemIds))
  }

  function handleBulkDeleteConfirm() {
    const ids = Array.from(selectedStemIds)
    const started = startBackgroundBulk({
      ids,
      toastId: nextBulkActionToastId('delete'),
      progress: bulkDeleteProgressToast(ids.length, 'question stem'),
      begin: () => {
        setBulkDeleteOpen(false)
        clearSelection()
      },
      run: () => deleteStems(ids),
      onSuccess: () => stemDeleteSuccessToast(ids),
      onError: (error) => lifecycleErrorToast(error, 'Cannot delete', router.push, openLifecycleEntity),
    })
    if (!started) throw new Error('already in progress')
  }

  const bulkDeleteInSetsCount = countStemsInSets(selectedStemIdsArray, rows)
  const singleDeleteInSetsCount = deletingStemId
    ? (rows.find((r) => r.id === deletingStemId)?.set_ids.length ?? 0)
    : 0
  const setFilterOptions = useMemo(() => {
    const q = setFilterSearch.trim().toLowerCase()
    const noneOption = { label: 'Not in any set', value: UCAT_FILTER_NOT_IN_ANY_SET }
    const fromSets = setsList
      .filter((s) => {
        if (!s.id) return false
        const name = proseMirrorToPlainText(s.name as Json | undefined).toLowerCase()
        return !q || name.includes(q)
      })
      .sort((a, b) =>
        proseMirrorToPlainText(a.name as Json | undefined).localeCompare(
          proseMirrorToPlainText(b.name as Json | undefined)
        )
      )
      .map((s) => ({
        label: proseMirrorToPlainText(s.name as Json | undefined) || 'Untitled',
        value: s.id as string,
      }))
    const combined = [noneOption, ...fromSets]
    if (!q) return combined
    return combined.filter((o) => o.label.toLowerCase().includes(q))
  }, [setsList, setFilterSearch])

  const sectionFilterDefs = useMemo((): DataTableFilterDefinition[] => {
    const selectedSectionIds = resolveSectionIdsFromIdFilter(tableState.state.filters)
    const scopedCategoryOptions = mapCategoriesToOptions(
      filterCategoriesForSections(categories.data ?? [], selectedSectionIds)
    ) as CategoryOption[]
    const scopedTagOptions = mapTagsToOptions(
      filterTagsForSections(tags.data ?? [], selectedSectionIds)
    ) as TagOption[]

    const base: DataTableFilterDefinition[] = [
      questionStemIdFilterDefinition,
      {
        ...filterDefinitions[0],
        options: (sections.data ?? []).map((s) => ({ label: s.name ?? 'Untitled', value: s.id ?? '' })),
      },
      {
        ...filterDefinitions[1],
        options: [
          { label: 'No category', value: UCAT_FILTER_NO_CATEGORY },
          ...scopedCategoryOptions.map((c) => ({
            label: taxonomyDisplayLabel(c),
            value: c.id ?? '',
          })),
        ],
      },
      {
        ...filterDefinitions[2],
        options: scopedTagOptions.map((tag) => ({
          label: tag.label ?? tag.name,
          value: tag.id,
        })),
      },
      filterDefinitions[3],
      filterDefinitions[4],
      ...(aiReviewEnabled ? [aiReviewFilterDefinition] : []),
      auditFilterDefinition,
      ...buildQuestionCatalogProvenanceFilters(createdByFilterOptions),
      {
        key: 'question_set_id',
        label: 'Set',
        options: setFilterOptions,
        searchable: true,
        searchPlaceholder: 'Search sets...',
      },
    ]
    return base
  }, [
    sections.data,
    categories.data,
    tags.data,
    tableState.state.filters,
    setFilterOptions,
    createdByFilterOptions,
    auditFilterDefinition,
    aiReviewEnabled,
  ])

  if (access.isLoading || questions.isLoading) {
    return <UcatPageSkeleton rows={8} />
  }
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="UCAT Questions"
        description="Draft, review, and publish complete question bundles"
        backHref="/ucat"
        breadcrumbs={[
          { label: 'UCAT', href: '/ucat' },
          { label: 'Questions', href: '/ucat/questions' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className={tutorBtnOutline}
              onClick={() => void handleViewQuestions()}
              disabled={reviewQueueLoading}
            >
              <ListChecks className="mr-2 h-4 w-4" />
              {reviewQueueLoading ? 'Preparing…' : 'View questions'}
            </Button>
            <SearchableSelect<(typeof addQuestionOptions)[number]>
              items={[...addQuestionOptions]}
              value={null}
              onValueChange={(option) => {
                if (option?.id === 'manual') setCreateOpen(true)
                if (option?.id === 'ai') setGenerateOpen(true)
                if (option?.id === 'bulk') setBulkImportOpen(true)
              }}
              getItemId={(option) => option.id}
              getItemLabel={(option) => option.label}
              getItemValue={(option) => `${option.label} ${option.description}`}
              searchPlaceholder="Search ways to add questions..."
              emptyMessage="No add action found"
              trigger={
                <Button type="button" className={tutorBtnPrimary}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              }
              renderItem={(option) => {
                const Icon = option.icon
                return (
                  <div className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="flex min-w-0 flex-col">
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </div>
                )
              }}
              contentWidth="320px"
              align="end"
              showChevron={false}
            />
          </div>
        }
      />

      <SegmentedControl
        className="w-fit max-w-full"
        value={activeTab}
        onValueChange={(value) => setActiveTab(parseQuestionsTab(value))}
        options={QUESTIONS_TAB_OPTIONS}
      />

      <DataTableToolbar
        state={toolbarTableState}
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
        {...tutorToolbarProps}
        searchPlaceholder="Search question stems"
        searchFromOptions={questionSearchScopeOptions}
        searchFromValue={searchScopes}
        onSearchFromChange={(values) => setSearchScopes(values as QuestionSearchScope[])}
        columnViewGroups={columnViewGroups}
        filterSearchValues={{ question_set_id: setFilterSearch }}
        onFilterSearchChange={(filterKey, value) => {
          if (filterKey === 'question_set_id') setSetFilterSearch(value)
        }}
        customFilterContent={{
          audit: (
            <AuditCatalogFilterMenu
              runs={catalogAuditRuns.data ?? []}
              selectedValues={(tableState.state.filters.audit ?? []).map(String)}
              onSelectedValuesChange={(values) => {
                const filters = { ...tableState.state.filters }
                if (values.length > 0) filters.audit = values
                else delete filters.audit
                tableState.actions.onFiltersChange(filters)
              }}
            />
          ),
          id: (
            <QuestionStemIdFilter
              ids={(tableState.state.filters.id ?? []).map(String)}
              onChange={(ids) => {
                const filters = { ...tableState.state.filters }
                if (ids.length > 0) filters.id = ids
                else delete filters.id
                tableState.actions.onFiltersChange(filters)
              }}
            />
          ),
          created_at_range: (
            <CreatedAtDateTimeRangeFilter
              fromValue={String(
                tableState.state.filters[CREATED_AT_FROM_FILTER_KEY]?.[0] ?? '',
              )}
              toValue={String(
                tableState.state.filters[CREATED_AT_TO_FILTER_KEY]?.[0] ?? '',
              )}
              onChange={(from, to) => {
                const filters = { ...tableState.state.filters }
                if (from) filters[CREATED_AT_FROM_FILTER_KEY] = [from]
                else delete filters[CREATED_AT_FROM_FILTER_KEY]
                if (to) filters[CREATED_AT_TO_FILTER_KEY] = [to]
                else delete filters[CREATED_AT_TO_FILTER_KEY]
                tableState.actions.onFiltersChange(filters)
              }}
            />
          ),
        }}
        filterFooter={
          <div className="px-2 py-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className={cn(tutorBtnOutline, 'w-full justify-center')}
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
        <div className={tutorTableShell}>
        <Table className="w-[1100px] table-fixed md:w-full">
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className={tutorTableHeaderRow}>
              <TableHead className="w-12" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleSelectAllVisible}
                  aria-label="Select all visible rows"
                />
              </TableHead>
              <TableHead className="w-12" />
              {visible('section_category') && <TableHead>Section</TableHead>}
              {visible('stem_text') && <TableHead>Stem text</TableHead>}
              {visible('question_count') && <TableHead>Questions</TableHead>}
              {visible('sets') && <TableHead>Sets</TableHead>}
              {visible('visibility') && (
                <TableHead>
                  <UcatVisibilityTableHeaderLabel />
                </TableHead>
              )}
              {visible('source') && <TableHead>Source</TableHead>}
              {visible('created_at') && <TableHead>Date created</TableHead>}
              {visible('status') && <TableHead>Status</TableHead>}
              {visible('review') && <TableHead>Review</TableHead>}
              {visible('type_summary') && <TableHead>Type</TableHead>}
              {visible('actions') && <TableHead className="w-16 shrink-0" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedRows.map((row) => {
              const isStemExpanded = expandedStemIds.has(row.id)
              const detail = detailsMap[row.id]
              const hasQuestions = (row.question_count ?? 0) > 0
              const categoryLabel = resolveCategoryPathLabel(
                categoryPathLookup,
                row.question_stem_category_id,
                row.category_name,
              )
              return (
                <React.Fragment key={row.id}>
                  <TableRow
                    className={cn(
                      tutorTableBodyRow,
                      row.deleted_at && 'bg-destructive/10',
                      selectedStemIds.has(row.id) && 'bg-muted/50',
                      !selectionMode && hasQuestions && 'cursor-pointer',
                    )}
                    onClick={() => {
                      if (selectionMode) {
                        toggleStemSelection(row.id)
                        return
                      }
                      if (hasQuestions) toggleStemExpanded(row.id)
                    }}
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
                        <span className="inline-flex rounded-lg p-1">
                          {isStemExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </span>
                      ) : null}
                    </TableCell>
                    {visible('section_category') && (
                      <TableCell className="max-w-[180px]">
                        <div className="space-y-0.5">
                          <div className="text-sm">{row.section_name}</div>
                          <div className="truncate text-xs text-muted-foreground" title={categoryLabel}>
                            {categoryLabel || '—'}
                          </div>
                        </div>
                      </TableCell>
                    )}
                    {visible('stem_text') && (
                      <TableCell className="max-w-[200px]" title={row.stem_text}>
                        {truncate(row.stem_text, 80)}
                      </TableCell>
                    )}
                    {visible('question_count') && <TableCell>{row.question_count}</TableCell>}
                    {visible('sets') && (
                      <TableCell className="max-w-[180px]">
                        {row.sets.length === 0 ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-normal px-1.5 py-0',
                              getUcatVisibilityColor(false),
                            )}
                          >
                            {row.is_available_in_question_pool ? 'Practice pool' : 'Not in practice pool'}
                          </Badge>
                        ) : (
                          <div className="space-y-1">
                            <div className="space-y-0.5">
                              {row.sets.map((set) => (
                                <button
                                  key={set.id}
                                  type="button"
                                  className="block max-w-full truncate text-left text-sm text-brand-darkBlue underline-offset-2 hover:underline dark:text-white"
                                  title={set.name}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setEditingSetId(set.id)
                                  }}
                                >
                                  {set.name}
                                </button>
                              ))}
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] font-normal px-1.5 py-0',
                                getUcatVisibilityColor(false),
                              )}
                            >
                              {row.is_available_in_question_pool ? 'Practice pool' : 'Not in practice pool'}
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                    )}
                    {visible('visibility') && (
                      <TableCell>
                        <UcatVisibilityBadge isPrivate={row.access_scope === 'private'} />
                      </TableCell>
                    )}
                    {visible('source') && (
                      <TableCell className="max-w-[200px]" title={stemSourceTooltip(row.source)}>
                        <div className="space-y-0.5">
                          <div className="text-sm">{row.source.channelLabel}</div>
                          {row.source.generatedByName ? (
                            <div className="text-xs text-muted-foreground truncate">{row.source.generatedByName}</div>
                          ) : null}
                          {row.source.sourceChannel === 'ai_generation' ? (
                            <div className="text-xs text-muted-foreground truncate">
                              {[row.source.aiModel ?? 'Unknown model', row.source.generatedAtLabel ?? 'Unknown date']
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          ) : null}
                          {row.source.tutorSourceNote ? (
                            <div className="text-xs text-muted-foreground truncate">{row.source.tutorSourceNote}</div>
                          ) : null}
                        </div>
                      </TableCell>
                    )}
                    {visible('created_at') && (
                      <TableCell>{formatDateTime(row.created_at ?? '') || '—'}</TableCell>
                    )}
                    {visible('status') && <TableCell className="capitalize">{row.status}</TableCell>}
                    {visible('review') && (
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                        {row.ai_review_status ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              'whitespace-nowrap font-normal',
                              UCAT_AI_REVIEW_STATUS_COPY[row.ai_review_status].className,
                            )}
                          >
                            {UCAT_AI_REVIEW_STATUS_COPY[row.ai_review_status].shortLabel}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {row.audit_memberships.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {row.audit_memberships.map((membership) => (
                              <Badge
                                key={`${membership.runId}:${membership.targetStatus}:${membership.result ?? ''}`}
                                variant="outline"
                                title={membership.why ?? undefined}
                                className={cn(
                                  'whitespace-nowrap font-normal',
                                  auditMembershipChipClassName(membership),
                                )}
                              >
                                {auditMembershipChipLabel(membership)}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                        </div>
                      </TableCell>
                    )}
                    {visible('type_summary') && <TableCell>{row.type_summary}</TableCell>}
                    {visible('actions') && (
                    <TableCell className="w-16 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        <UcatRowActions
                          actions={[
                            {
                              label: row.status === 'published' ? 'View' : 'Edit',
                              icon:
                                row.status === 'published' ? (
                                  <Eye className="h-4 w-4" />
                                ) : (
                                  <Pencil className="h-4 w-4" />
                                ),
                              onClick: () => setEditingStemId(row.id),
                            },
                            ...(!showDeleted && row.status === 'draft'
                              ? [{ label: 'Send for review', icon: <Send className="h-4 w-4" />, onClick: () => changeQuestionStatus(row.id, 'in_review', row.status, 'Cannot send for review') }]
                              : []),
                            ...(!showDeleted && row.status === 'in_review'
                              ? [
                                  { label: 'Publish', icon: <CheckCircle2 className="h-4 w-4" />, onClick: () => changeQuestionStatus(row.id, 'published', row.status, 'Cannot publish') },
                                  { label: 'Return to draft', icon: <FilePenLine className="h-4 w-4" />, onClick: () => changeQuestionStatus(row.id, 'draft', row.status, 'Cannot return to draft') },
                                ]
                              : []),
                            ...(!showDeleted && row.status === 'published'
                              ? [
                                  { label: 'Move to review', icon: <ListChecks className="h-4 w-4" />, onClick: () => changeQuestionStatus(row.id, 'in_review', row.status, 'Cannot move question') },
                                  { label: 'Move to draft', icon: <FilePenLine className="h-4 w-4" />, onClick: () => changeQuestionStatus(row.id, 'draft', row.status, 'Cannot move question') },
                                ]
                              : []),
                            ...(!showDeleted
                              ? [
                                  ...(shouldShowRequestAiReviewAction(row.ai_review_status ?? undefined)
                                    ? [{
                                        label: 'Request AI review',
                                        icon: <Bot className="h-4 w-4" />,
                                        onClick: () => void requestAiReview(row.id),
                                      }]
                                    : []),
                                  {
                                    label: 'Find question stems with similar',
                                    render: () => (
                                      <FindSimilarQuestionStemsSubmenu
                                        row={row}
                                        tagLabelsById={tagLabelsById}
                                        onApply={(filters) => {
                                          tableState.actions.onFiltersChange(filters)
                                        }}
                                      />
                                    ),
                                  },
                                ]
                              : []),
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
                                {visibleQuestion('index') && (
                                  <TableHead className="w-16 shrink-0">Index</TableHead>
                                )}
                                {visibleQuestion('question_text') && (
                                  <TableHead className="min-w-0">Question text</TableHead>
                                )}
                                {visibleQuestion('explanation') && (
                                  <TableHead className="min-w-0">Explanation</TableHead>
                                )}
                                {visibleQuestion('difficulty') && (
                                  <TableHead className="w-24 shrink-0">Difficulty</TableHead>
                                )}
                                {visibleQuestion('time_burden') && (
                                  <TableHead className="w-32 shrink-0">Expected time to correct</TableHead>
                                )}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {[...detail.questions]
                                .sort((a, b) => a.index - b.index)
                                .map((q) => {
                                const qKey = `${row.id}-${q.id}`
                                const isQExpanded = expandedQuestionKeys.has(qKey)
                                const qText = proseMirrorToPlainText(q.question_text)
                                const qExplanation = proseMirrorToPlainText(q.answer_explanation)
                                const hasOptions = (q.answer_options?.length ?? 0) > 0
                                return (
                                  <React.Fragment key={q.id}>
                                    <TableRow
                                      className={cn(hasOptions && 'cursor-pointer')}
                                      onClick={() => {
                                        if (hasOptions) toggleQuestionExpanded(row.id, q.id)
                                      }}
                                    >
                                      <TableCell className="w-12">
                                        {hasOptions ? (
                                          <span className="inline-flex rounded-lg p-1">
                                            {isQExpanded ? (
                                              <ChevronDown className="h-4 w-4" />
                                            ) : (
                                              <ChevronRight className="h-4 w-4" />
                                            )}
                                          </span>
                                        ) : null}
                                      </TableCell>
                                      {visibleQuestion('index') && <TableCell>{q.index}</TableCell>}
                                      {visibleQuestion('question_text') && (
                                        <TableCell className="max-w-[240px]" title={qText}>
                                          {truncate(qText, 60)}
                                        </TableCell>
                                      )}
                                      {visibleQuestion('explanation') && (
                                        <TableCell className="max-w-[240px]" title={qExplanation}>
                                          {qExplanation ? truncate(qExplanation, 60) : '—'}
                                        </TableCell>
                                      )}
                                      {visibleQuestion('difficulty') && (
                                        <TableCell>{q.difficulty ?? '-'}</TableCell>
                                      )}
                                      {visibleQuestion('time_burden') && (
                                        <TableCell>{formatSecondsToDuration(q.time_burden_seconds)}</TableCell>
                                      )}
                                    </TableRow>
                                    {isQExpanded && q.answer_options && q.answer_options.length > 0 && (
                                      <TableRow>
                                        <TableCell colSpan={questionColCount} className="bg-muted/20 p-0 align-top w-full">
                                          <div className="w-full min-w-0 p-2 pl-14">
                                            <Table className="w-full table-fixed">
                                              <TableHeader>
                                                <TableRow>
                                                  {visibleAnswerOption('index') && (
                                                    <TableHead className="w-16 shrink-0">Index</TableHead>
                                                  )}
                                                  {visibleAnswerOption('answer_text') && (
                                                    <TableHead className="min-w-0">Answer text</TableHead>
                                                  )}
                                                  {visibleAnswerOption('answer_explanation') && (
                                                    <TableHead className="min-w-0">Answer explanation</TableHead>
                                                  )}
                                                  {visibleAnswerOption('answer_key_value') && (
                                                    <TableHead className="w-28 shrink-0">Answer key</TableHead>
                                                  )}
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {[...q.answer_options]
                                                  .sort((a, b) => a.index - b.index)
                                                  .map((opt) => (
                                                  <TableRow key={opt.id}>
                                                    {visibleAnswerOption('index') && (
                                                      <TableCell>{opt.index}</TableCell>
                                                    )}
                                                    {visibleAnswerOption('answer_text') && (
                                                      <TableCell
                                                        className="max-w-[200px]"
                                                        title={proseMirrorToPlainText(opt.answer_text)}
                                                      >
                                                        {truncate(proseMirrorToPlainText(opt.answer_text), 50)}
                                                      </TableCell>
                                                    )}
                                                    {visibleAnswerOption('answer_explanation') && (
                                                      <TableCell
                                                        className="max-w-[200px]"
                                                        title={proseMirrorToPlainText(opt.answer_explanation)}
                                                      >
                                                        {truncate(
                                                          proseMirrorToPlainText(opt.answer_explanation),
                                                          50,
                                                        )}
                                                      </TableCell>
                                                    )}
                                                    {visibleAnswerOption('answer_key_value') && (
                                                      <TableCell>{opt.answer_key_value ?? 'Not keyed'}</TableCell>
                                                    )}
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
        onCancel={clearSelection}
        onDelete={() => setBulkDeleteOpen(true)}
        deletePending={bulkSelectionBusy}
      >
        <SearchableSelect<CategoryOption>
          items={categoryOptions}
          value={null}
          disabled={bulkSelectionBusy}
          onValueChange={(c) => {
            if (c?.id) {
              setBulkCategoryId(c.id)
              setBulkCategoryOpen(true)
            }
          }}
          getItemId={(c) => c.id ?? ''}
          getItemLabel={(c) => taxonomyDisplayLabel(c)}
          getItemValue={(c) => taxonomyDisplayLabel(c)}
          placeholder="Category"
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found"
          trigger={
            <Button variant="outline" size="sm" className={tutorBtnOutline}>
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
          disabled={bulkSelectionBusy}
          trigger={
            <Button variant="outline" size="sm" className={tutorBtnOutline}>
              Visibility
            </Button>
          }
          contentWidth="160px"
          align="start"
          side="top"
        />
        <SearchableSelect<{ value: UcatContentStatus; label: string }>
          items={bulkStatusOptions}
          value={null}
          onValueChange={(item) => {
            if (!item) return
            setBulkStatus(item.value)
            setBulkStatusOpen(true)
          }}
          getItemId={(item) => item.value}
          getItemLabel={(item) => item.label}
          placeholder="Status"
          searchPlaceholder="Search statuses..."
          emptyMessage="No status found"
          disabled={bulkSelectionBusy}
          trigger={
            <Button variant="outline" size="sm" className={tutorBtnOutline}>
              Status
            </Button>
          }
          contentWidth="180px"
          align="start"
          side="top"
        />
      </UcatSelectionToolbar>

      <AlertDialog open={bulkCategoryOpen} onOpenChange={setBulkCategoryOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Set category for {selectedStemIds.size} stem(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Category will be set to &quot;{taxonomyDisplayLabel(categoryOptions.find((c) => c.id === bulkCategoryId) ?? { name: '' })}&quot; for all selected stems.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleBulkCategoryConfirm()}>
              Yes
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleBulkVisibilityConfirm()}>
              Yes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={bulkStatusOpen} onOpenChange={setBulkStatusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {selectedStemIds.size} question(s) to {bulkStatus?.replace('_', ' ')}?</AlertDialogTitle>
            <AlertDialogDescription>
              Eligible questions will move. Any blocked questions will remain in their current status.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleBulkStatusConfirm()}>
              Move questions
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UcatDeleteConfirmDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !open && setBulkDeleteOpen(false)}
        title={`Delete ${selectedStemIds.size} question stem(s)?`}
        description={
          bulkDeleteInSetsCount > 0
            ? `${bulkDeleteInSetsCount} of the selected stem(s) are in one or more sets. Remove them from those sets before deleting. No set membership will be changed automatically.`
            : 'The selected stems will be hidden from students. You can restore them later from the deleted list.'
        }
        onConfirm={handleBulkDeleteConfirm}
      />

      <UcatQuestionStemDialog
        open={createOpen}
        title="Create Question Stem"
        submitLabel="Create"
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        sections={(sections.data ?? []).map((section) => ({
          id: section.id,
          name: section.name,
          display_columns: section.display_columns,
        }))}
        categories={categoryOptions}
        tags={tagOptions}
        loading={createMutation.isPending}
      />

      <UcatQuestionStemDialog
        open={!!editingStemId}
        title="Edit Question Stem"
        submitLabel="Save"
        onClose={() => setEditingStemId(null)}
        onSubmit={handleUpdate}
        sections={(sections.data ?? []).map((section) => ({
          id: section.id,
          name: section.name,
          display_columns: section.display_columns,
        }))}
        categories={categoryOptions}
        tags={tagOptions}
        initial={detail.data}
        initialEditorMode={editDialogInitialMode}
        loading={updateMutation.isPending || detail.isLoading}
        onOpenLifecycleEntity={openLifecycleEntity}
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
        description={
          singleDeleteInSetsCount > 0
            ? `This question stem is in ${singleDeleteInSetsCount} set(s). Remove it from those sets before deleting. No set membership will be changed automatically.`
            : 'The stem and all its questions will be hidden from students. You can restore them later from the deleted list.'
        }
        onConfirm={async () => {
          if (!deletingStemId) return
          setSingleDeletePending(true)
          try {
            await deleteStemsWithToast([deletingStemId])
            setEditingStemId((prev) => (prev === deletingStemId ? null : prev))
          } catch (err) {
            toast(lifecycleErrorToast(err, 'Cannot delete', router.push, openLifecycleEntity))
          } finally {
            setSingleDeletePending(false)
          }
        }}
        isPending={singleDeletePending}
      />

      <BulkImportQuestionStemsModal
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        onSubmit={handleBulkImportSubmit}
        onEditSet={(setId) => setEditingSetId(setId)}
      />
      <GenerateQuestionStemsModal open={generateOpen} onClose={() => setGenerateOpen(false)} />
      <UcatQuestionStemApprovalQueueDialog
        open={approvalQueueOpen}
        title="View question stems"
        entries={reviewQueueEntries}
        workflowStatus={activeTab}
        onClose={() => setApprovalQueueOpen(false)}
      />

      <UcatSetEditorDialog
        open={!!editingSetId}
        setId={editingSetId}
        onClose={() => setEditingSetId(null)}
      />
    </div>
  )
}
