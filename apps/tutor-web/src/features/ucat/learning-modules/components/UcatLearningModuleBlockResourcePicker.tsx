'use client'

import { useMemo, useState } from 'react'
import type { DataTableSortOption } from '@altitutor/shared'
import {
  Badge,
  Button,
  getUcatVisibilityColor,
  useToast,
} from '@altitutor/ui'
import { Eye, Pencil, Plus, Search, X } from 'lucide-react'
import type {
  UcatQuestionCatalogItem,
  UcatStemCatalogItem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  useUcatCategories,
  useUcatQuestionDetail,
  useUcatSections,
  useUcatTags,
  useUpdateUcatQuestionStem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import {
  UcatQuestionStemDialog,
  type CategoryOption,
  type TagOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { filterOptionsWithContent } from '@/features/ucat/shared/lib/rich-text'
import { UcatStemCatalogListPanel } from '@/features/ucat/shared/components/ucat-stem-catalog-panel'
import { UcatCatalogListPanel } from '@/features/ucat/shared/components/ucat-catalog-list-panel'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import {
  applyBooleanTextFilter,
  applyCategoryFilter,
  applyMultiSelectFilter,
  applySort,
  applyTagFilter,
  getFilterValues,
} from '@/features/ucat/shared/hooks/useUcatTableState'
import { useUcatCatalogListState } from '@/features/ucat/shared/hooks/useUcatCatalogListState'
import { paginateCatalogItems } from '@/features/ucat/shared/lib/ucat-catalog-pagination'
import { parseTimeToSeconds } from '@/features/ucat/shared/lib/time-utils'
import {
  buildTaxonomyPathLookup,
  categoriesToTaxonomyNodes,
  mapCategoriesToOptions,
  mapTagsToOptions,
} from '@/features/ucat/shared/lib/taxonomy-paths'
import {
  buildStemCatalogFilterDefinitions,
  buildStemCatalogSetFilterOptions,
} from '@/features/ucat/shared/lib/stem-catalog-filters'
import {
  UCAT_FILTER_NO_CATEGORY,
  UCAT_FILTER_NOT_IN_ANY_SET,
} from '@/features/ucat/shared/lib/table-filter-sentinel'
import type { UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import type { UcatSection } from '@/features/ucat/shared/types'
import { cn } from '@/shared/utils'

function SelectedQuestionCard({
  title,
  stemId,
  label,
  onView,
}: {
  title: string
  stemId: string | null
  label: string | null
  onView: () => void
}) {
  if (!stemId) {
    return (
      <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
        No {title.toLowerCase()} selected.
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-muted/20 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{label ?? title}</p>
          <p className="mt-1 text-xs text-muted-foreground">Open the stem viewer to inspect the rendered question content.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onView}>
          View
        </Button>
      </div>
    </div>
  )
}

const questionSortOptions: DataTableSortOption[] = [
  { key: 'label', label: 'Question' },
  { key: 'section_name', label: 'Section' },
  { key: 'question_type', label: 'Type' },
  { key: 'stem_text', label: 'Stem' },
]

type QuestionPickerRow = {
  question: UcatQuestionCatalogItem
  stem: UcatStemCatalogItem | null
}

function QuestionPickerList({
  rows,
  sections,
  categories,
  tags,
  setsList,
  categoryPathLookup,
  setFilterSearch,
  onSetFilterSearchChange,
  onSelect,
  onViewQuestion,
  onEditQuestion,
}: {
  rows: QuestionPickerRow[]
  sections: UcatSection[]
  categories: Parameters<typeof buildStemCatalogFilterDefinitions>[1]
  tags: Parameters<typeof buildStemCatalogFilterDefinitions>[2]
  setsList: Parameters<typeof buildStemCatalogSetFilterOptions>[0]
  categoryPathLookup: Map<string, string>
  setFilterSearch: string
  onSetFilterSearchChange: (value: string) => void
  onSelect: (questionId: string) => void
  onViewQuestion: (stemId: string, questionIndex: number) => void
  onEditQuestion: (stemId: string, questionIndex: number) => void
}) {
  const listState = useUcatCatalogListState(['label', 'section_name', 'question_type'])
  const { state, actions } = listState
  const filterDefinitions = useMemo(
    () =>
      buildStemCatalogFilterDefinitions(
        sections,
        categories,
        tags,
        state.filters,
        buildStemCatalogSetFilterOptions(setsList, setFilterSearch),
      ),
    [categories, sections, setFilterSearch, setsList, state.filters, tags],
  )

  const filtered = useMemo(() => {
    const query = state.search.trim().toLowerCase()
    return rows.filter((row) => {
      const stem = row.stem
      const searchHit =
        !query ||
        row.question.label.toLowerCase().includes(query) ||
        row.question.sectionName.toLowerCase().includes(query) ||
        row.question.questionType.toLowerCase().includes(query) ||
        (stem?.text ?? '').toLowerCase().includes(query) ||
        (stem?.questionSearchText ?? '').toLowerCase().includes(query)

      if (!searchHit) return false
      if (!applyMultiSelectFilter(state, 'section_id', stem?.sectionId ?? null)) return false
      if (!applyCategoryFilter(state, stem?.categoryId ?? null, UCAT_FILTER_NO_CATEGORY)) return false
      if (!applyTagFilter(state, stem?.tagIds ?? [])) return false
      if (!applyBooleanTextFilter(state, 'visibility', stem?.isPrivate ?? false)) return false
      if (!applyMultiSelectFilter(state, 'question_type', row.question.questionType)) return false

      const selectedSetIds = getFilterValues(state, 'question_set_id').map(String)
      if (selectedSetIds.length === 0) return true
      const wantsNotInAnySet = selectedSetIds.includes(UCAT_FILTER_NOT_IN_ANY_SET)
      const specificSetIds = selectedSetIds.filter((id) => id !== UCAT_FILTER_NOT_IN_ANY_SET)
      return (
        (wantsNotInAnySet && (stem?.setIds.length ?? 0) === 0) ||
        specificSetIds.some((setId) => stem?.setIds.includes(setId))
      )
    })
  }, [rows, state])

  const sorted = useMemo(
    () =>
      applySort(filtered, state.sortBy, state.sortDirection, {
        label: (row) => row.question.label,
        section_name: (row) => row.question.sectionName,
        question_type: (row) => row.question.questionType,
        stem_text: (row) => row.stem?.text ?? '',
      }),
    [filtered, state.sortBy, state.sortDirection],
  )

  const { items, total } = useMemo(
    () => paginateCatalogItems(sorted, state.page, state.pageSize),
    [sorted, state.page, state.pageSize],
  )

  return (
    <UcatCatalogListPanel
      search={state.search}
      onSearchChange={actions.onSearchChange}
      searchPlaceholder="Search questions or stems..."
      filterDefinitions={filterDefinitions}
      filters={state.filters}
      onFiltersChange={actions.onFiltersChange}
      filterSearchValues={{ question_set_id: setFilterSearch }}
      onFilterSearchChange={(filterKey, value) => {
        if (filterKey === 'question_set_id') onSetFilterSearchChange(value)
      }}
      sortOptions={questionSortOptions}
      sortBy={state.sortBy}
      sortDirection={state.sortDirection}
      onSortChange={actions.onSortChange}
      page={state.page}
      pageSize={state.pageSize}
      total={total}
      onPageChange={actions.onPageChange}
      emptyMessage="No matching questions."
      hasItems={items.length > 0}
    >
      {items.map(({ question, stem }) => (
        <div
          key={question.id}
          className="flex items-start justify-between gap-3 rounded-xl bg-card px-2 py-2 text-sm shadow-sm ring-1 ring-black/[0.06] hover:bg-muted/40 dark:ring-white/[0.08]"
        >
          <div className="min-w-0">
            <p className="line-clamp-2 font-medium">{question.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {question.sectionName} · {question.questionType}
            </p>
            {stem ? (
              <>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{stem.text}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span>
                    {stem.sectionNumber}. {stem.sectionName}
                  </span>
                  {stem.categoryId ? <span>· {categoryPathLookup.get(stem.categoryId) ?? stem.categoryName}</span> : null}
                  <Badge
                    variant="outline"
                    className={cn('px-1.5 py-0 text-[10px] font-normal', getUcatVisibilityColor(stem.isPrivate))}
                  >
                    {stem.isPrivate ? 'Private' : 'Public'}
                  </Badge>
                </p>
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {stem ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onViewQuestion(stem.id, question.questionIndex)}
                  aria-label={`View ${question.label}`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEditQuestion(stem.id, question.questionIndex)}
                  aria-label={`Edit ${question.label}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              size="icon"
              className="h-8 w-8"
              onClick={() => onSelect(question.id)}
              aria-label={`Add ${question.label}`}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </UcatCatalogListPanel>
  )
}

export function LearningModuleQuestionResourcePicker({
  type,
  stemOptions,
  questionOptions,
  selectedStemId,
  selectedQuestionId,
  onSelectStem,
  onSelectQuestion,
}: {
  type: 'question_stem' | 'question'
  stemOptions: UcatStemCatalogItem[]
  questionOptions: UcatQuestionCatalogItem[]
  selectedStemId: string | null
  selectedQuestionId: string | null
  onSelectStem: (stemId: string | null) => void
  onSelectQuestion: (questionId: string | null) => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown[]>>({})
  const [setFilterSearch, setSetFilterSearch] = useState('')
  const [viewingStemId, setViewingStemId] = useState<string | null>(null)
  const [viewingInitialQuestionIndex, setViewingInitialQuestionIndex] = useState<number | undefined>(undefined)
  const [editingStemId, setEditingStemId] = useState<string | null>(null)
  const [editingInitialQuestionIndex, setEditingInitialQuestionIndex] = useState<number | undefined>(undefined)
  const stemById = useMemo(() => new Map(stemOptions.map((stem) => [stem.id, stem])), [stemOptions])
  const questionRows = useMemo(
    () =>
      questionOptions.map((question) => ({
        question,
        stem: stemById.get(question.stemId) ?? null,
      })),
    [questionOptions, stemById],
  )
  const selectedQuestion = selectedQuestionId
    ? questionOptions.find((question) => question.id === selectedQuestionId) ?? null
    : null
  const selectedStem = selectedStemId ? stemOptions.find((stem) => stem.id === selectedStemId) ?? null : null
  const previewStemId = type === 'question' ? selectedQuestion?.stemId ?? null : selectedStemId
  const title = type === 'question' ? 'Question' : 'Question stem'
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const setsQuery = useUcatSets()
  const viewingStemDetail = useUcatQuestionDetail(viewingStemId)
  const editingStemDetail = useUcatQuestionDetail(editingStemId)
  const updateStemMutation = useUpdateUcatQuestionStem()
  const filterDefinitions = useMemo(
    () =>
      buildStemCatalogFilterDefinitions(
        sectionsQuery.data ?? [],
        categoriesQuery.data ?? [],
        tagsQuery.data ?? [],
        filters,
        buildStemCatalogSetFilterOptions(setsQuery.data ?? [], setFilterSearch),
      ),
    [categoriesQuery.data, filters, sectionsQuery.data, setFilterSearch, setsQuery.data, tagsQuery.data],
  )
  const categoryPathLookup = useMemo(
    () => buildTaxonomyPathLookup(categoriesToTaxonomyNodes(categoriesQuery.data ?? [])),
    [categoriesQuery.data],
  )
  const stemDialogSections = useMemo(
    () =>
      (sectionsQuery.data ?? []).map((section) => ({
        id: section.id,
        name: section.name,
        display_columns: section.display_columns,
      })),
    [sectionsQuery.data],
  )
  const stemDialogCategories = useMemo(
    () => mapCategoriesToOptions(categoriesQuery.data ?? []) as CategoryOption[],
    [categoriesQuery.data],
  )
  const stemDialogTags = useMemo(
    () => mapTagsToOptions(tagsQuery.data ?? []) as TagOption[],
    [tagsQuery.data],
  )

  async function handleStemUpdate(stemId: string | null, payload: UcatQuestionStemFormValues, onSuccess: () => void) {
    if (!stemId) return
    const mapped: UcatQuestionStemBundlePayload = {
      stemId,
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
      await updateStemMutation.mutateAsync({ stemId, payload: mapped })
      onSuccess()
    } catch (error) {
      toast({
        title: 'Failed to save question stem',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {type === 'question'
                ? selectedQuestion?.label ?? selectedQuestionId ?? 'No question selected'
                : selectedStem?.text ?? selectedStemId ?? 'No stem selected'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {selectedStemId || selectedQuestionId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (type === 'question') onSelectQuestion(null)
                  else onSelectStem(null)
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Clear
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Search className="mr-2 h-4 w-4" />
              {selectedStemId || selectedQuestionId ? `Change ${title.toLowerCase()}` : `Choose ${title.toLowerCase()}`}
            </Button>
          </div>
        </div>

        <SelectedQuestionCard
          title={title}
          stemId={previewStemId}
          label={type === 'question' ? selectedQuestion?.label ?? selectedQuestionId : selectedStem?.text ?? selectedStemId}
          onView={() => {
            if (!previewStemId) return
            setViewingStemId(previewStemId)
            setViewingInitialQuestionIndex(type === 'question' ? selectedQuestion?.questionIndex : undefined)
          }}
        />
      </div>

      <UcatDialogShell
        open={open}
        onClose={() => setOpen(false)}
        title={type === 'question' ? 'Choose question' : 'Choose question stem'}
        subtitle="Search, filter, and sort the catalog. Add selects the linked resource for this block."
        hideCancel
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
          {type === 'question_stem' ? (
            <UcatStemCatalogListPanel
              stems={stemOptions}
              search={search}
              onSearchChange={setSearch}
              filters={filters}
              onFiltersChange={setFilters}
              filterDefinitions={filterDefinitions}
              categoryPathLookup={categoryPathLookup}
              filterSearchValues={{ question_set_id: setFilterSearch }}
              onFilterSearchChange={(filterKey, value) => {
                if (filterKey === 'question_set_id') setSetFilterSearch(value)
              }}
              onAddStem={(stemId) => {
                onSelectStem(stemId)
                setOpen(false)
              }}
              onViewStem={(stemId) => {
                setViewingStemId(stemId)
                setViewingInitialQuestionIndex(undefined)
              }}
              onEditStem={(stemId) => {
                setEditingStemId(stemId)
                setEditingInitialQuestionIndex(undefined)
              }}
              searchPlaceholder="Search stems or questions"
              emptyMessage="No matching stems."
            />
          ) : (
            <QuestionPickerList
              rows={questionRows}
              sections={sectionsQuery.data ?? []}
              categories={categoriesQuery.data ?? []}
              tags={tagsQuery.data ?? []}
              setsList={setsQuery.data ?? []}
              categoryPathLookup={categoryPathLookup}
              setFilterSearch={setFilterSearch}
              onSetFilterSearchChange={setSetFilterSearch}
              onSelect={(questionId) => {
                onSelectQuestion(questionId)
                setOpen(false)
              }}
              onViewQuestion={(stemId, questionIndex) => {
                setViewingStemId(stemId)
                setViewingInitialQuestionIndex(questionIndex)
              }}
              onEditQuestion={(stemId, questionIndex) => {
                setEditingStemId(stemId)
                setEditingInitialQuestionIndex(questionIndex)
              }}
            />
          )}
        </div>
      </UcatDialogShell>

      <UcatQuestionStemDialog
        open={!!viewingStemId}
        title="View Question Stem"
        submitLabel="Save"
        onClose={() => {
          setViewingStemId(null)
          setViewingInitialQuestionIndex(undefined)
        }}
        onSubmit={(payload) =>
          handleStemUpdate(viewingStemId, payload, () => {
            setViewingStemId(null)
            setViewingInitialQuestionIndex(undefined)
          })
        }
        sections={stemDialogSections}
        categories={stemDialogCategories}
        tags={stemDialogTags}
        initial={viewingStemDetail.data}
        loading={viewingStemDetail.isLoading}
        initialEditorMode="view"
        initialQuestionIndex={viewingInitialQuestionIndex}
      />

      <UcatQuestionStemDialog
        open={!!editingStemId}
        title="Edit Question Stem"
        submitLabel="Save"
        onClose={() => {
          setEditingStemId(null)
          setEditingInitialQuestionIndex(undefined)
        }}
        onSubmit={(payload) =>
          handleStemUpdate(editingStemId, payload, () => {
            setEditingStemId(null)
            setEditingInitialQuestionIndex(undefined)
          })
        }
        sections={stemDialogSections}
        categories={stemDialogCategories}
        tags={stemDialogTags}
        initial={editingStemDetail.data}
        loading={editingStemDetail.isLoading || updateStemMutation.isPending}
        initialQuestionIndex={editingInitialQuestionIndex}
      />
    </>
  )
}
