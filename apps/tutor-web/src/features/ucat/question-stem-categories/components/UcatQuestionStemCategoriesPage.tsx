'use client'

import { useCallback, useMemo, useState } from 'react'
import { Button, Input, SearchableSelect, Textarea, useToast } from '@altitutor/ui'
import { Pencil, Search } from 'lucide-react'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import {
  useCreateUcatQuestionStemCategory,
  useDeleteUcatQuestionStemCategory,
  useUpdateUcatQuestionStemCategory,
  useUcatQuestionStemCategories,
} from '@/features/ucat/question-stem-categories/hooks/useUcatQuestionStemCategories'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import {
  buildTaxonomyPathLookup,
  categoriesToTaxonomyNodes,
  mapCategoriesToOptions,
  mapTagsToOptions,
  taxonomyDisplayLabel,
} from '@/features/ucat/shared/lib/taxonomy-paths'
import { UcatQuestionStemCategoryDialog } from '@/features/ucat/question-stem-categories/components/UcatQuestionStemCategoryDialog'
import {
  TaxonomyHierarchyTree,
  TaxonomySectionDropZone,
  type TaxonomyReparentTarget,
} from '@/features/ucat/shared/components/taxonomy-hierarchy-tree'
import { TaxonomyHierarchyDndProvider } from '@/features/ucat/shared/components/taxonomy-hierarchy-dnd'
import {
  flattenTaxonomyHierarchyNodes,
  mapToTaxonomyHierarchyNodes,
} from '@/features/ucat/shared/lib/map-taxonomy-tree'
import { isDescendantOf } from '@/features/ucat/shared/lib/taxonomy-reparent'
import {
  buildCategoryTreeNodes,
  filterCategoryTreeNodes,
} from '@/features/ucat/question-stem-categories/lib/build-category-tree'
import type {
  UcatCategoryLinkedStem,
  UcatQuestionStemCategoryDraft,
  UcatQuestionStemCategoryRow,
} from '@/features/ucat/question-stem-categories/types'
import { UcatQuestionStemDialog } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { CategoryOption, TagOption } from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import type { UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  useUcatCategories,
  useUcatQuestionDetail,
  useUcatSections,
  useUcatTags,
  useUpdateUcatQuestionStem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { filterOptionsWithContent } from '@/features/ucat/shared/lib/rich-text'
import { parseTimeToSeconds } from '@/features/ucat/shared/lib/time-utils'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'
import { useQueryClient } from '@tanstack/react-query'
import type { Json } from '@altitutor/shared'

const emptyDraft: UcatQuestionStemCategoryDraft = {
  name: '',
  sectionId: 'none',
  parentCategoryId: 'none',
  description: '',
}

function toExplanationNull(value: unknown): Json | null {
  if (value == null) return null
  if (typeof value === 'string' && value === 'null') return null
  return value as Json
}

function mapFormValuesToBundlePayload(
  payload: UcatQuestionStemFormValues,
  stemId: string
): UcatQuestionStemBundlePayload {
  return {
    stemId,
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

function CategoryCreateForm({
  draft,
  setDraft,
  sections,
  parentOptions,
  categoryPathLookup,
  onSectionChange,
}: {
  draft: UcatQuestionStemCategoryDraft
  setDraft: React.Dispatch<React.SetStateAction<UcatQuestionStemCategoryDraft>>
  sections: Array<{ id: string | null; name: string | null }>
  parentOptions: UcatQuestionStemCategoryRow[]
  categoryPathLookup: Map<string, string>
  onSectionChange: () => void
}) {
  const sectionSelected = draft.sectionId !== 'none'
  const sectionItems = [
    { id: 'none', name: 'Select section' },
    ...sections.map((section) => ({ id: section.id ?? '', name: section.name ?? 'Unknown' })),
  ]
  const selectedSection =
    sectionItems.find((section) => section.id === draft.sectionId) ?? sectionItems[0]
  const parentItems = [
    { id: 'none', name: 'No parent', label: 'No parent' },
    ...parentOptions.map((row) => ({
      id: row.id,
      name: row.name,
      label: categoryPathLookup.get(row.id) ?? row.name,
    })),
  ]
  const selectedParent =
    parentItems.find((item) => item.id === draft.parentCategoryId) ?? parentItems[0]

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Section</span>
        <SearchableSelect<{ id: string; name: string }>
          items={sectionItems}
          value={selectedSection}
          onValueChange={(item) => {
            if (item) {
              setDraft((prev) => ({ ...prev, sectionId: item.id }))
              onSectionChange()
            }
          }}
          getItemLabel={(section) => section.name}
          getItemId={(section) => section.id}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Name</span>
        <Input
          value={draft.name}
          onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Parent category</span>
        <SearchableSelect<{ id: string; name: string; label: string }>
          items={parentItems}
          value={selectedParent}
          onValueChange={(item) =>
            setDraft((prev) => ({ ...prev, parentCategoryId: item?.id ?? 'none' }))
          }
          getItemLabel={(item) => taxonomyDisplayLabel(item)}
          getItemId={(item) => item.id}
          placeholder={sectionSelected ? undefined : 'Select section first'}
          disabled={!sectionSelected}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Description</span>
        <Textarea
          className="min-h-24"
          value={draft.description}
          onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
        />
      </label>
    </div>
  )
}

export function UcatQuestionStemCategoriesPage() {
  const access = useUcatAccess()
  const categories = useUcatQuestionStemCategories()
  const sections = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const createCategory = useCreateUcatQuestionStemCategory()
  const updateCategory = useUpdateUcatQuestionStemCategory()
  const deleteCategory = useDeleteUcatQuestionStemCategory()
  const updateStemMutation = useUpdateUcatQuestionStem()

  const [searchQuery, setSearchQuery] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
  const [draft, setDraft] = useState<UcatQuestionStemCategoryDraft>(emptyDraft)
  const [editingStemId, setEditingStemId] = useState<string | null>(null)

  const sectionNameMap = useMemo(
    () => new Map((sections.data ?? []).map((section) => [section.id ?? '', section.name ?? '-'])),
    [sections.data]
  )

  const rows: UcatQuestionStemCategoryRow[] = useMemo(() => {
    const data = categories.data ?? []
    return data.map((category) => {
      const row = category as typeof category & { question_stem_count?: number }
      return {
        id: row.id ?? '',
        name: row.name ?? '-',
        section_id: row.ucat_section_id,
        section_name: sectionNameMap.get(row.ucat_section_id ?? '') ?? '-',
        parent_id: row.parent_question_stem_category_id,
        description: proseMirrorToPlainText(row.description),
        question_stem_count: row.question_stem_count ?? 0,
      }
    })
  }, [categories.data, sectionNameMap])

  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])
  const categoryPathLookup = useMemo(
    () => buildTaxonomyPathLookup(categoriesToTaxonomyNodes(categories.data ?? [])),
    [categories.data]
  )

  const editingCategory = editingCategoryId ? (rowById.get(editingCategoryId) ?? null) : null

  const sectionTrees = useMemo(() => {
    const sectionList = [...(sections.data ?? [])].sort(
      (a, b) => (a.section_number ?? 0) - (b.section_number ?? 0)
    )
    return sectionList.map((section) => {
      const sectionRows = rows.filter((row) => row.section_id === section.id)
      const rootNodes = buildCategoryTreeNodes(sectionRows, null)
      const filtered = filterCategoryTreeNodes(rootNodes, searchQuery)
      return {
        sectionId: section.id ?? '',
        sectionName: section.name ?? 'Unknown section',
        nodes: mapToTaxonomyHierarchyNodes(filtered, 'question_stem_count'),
      }
    })
  }, [rows, searchQuery, sections.data])

  const allHierarchyNodes = useMemo(
    () => sectionTrees.flatMap((section) => section.nodes),
    [sectionTrees]
  )

  const createParentOptions = useMemo(() => {
    if (draft.sectionId === 'none') return []
    return rows.filter((row) => row.section_id === draft.sectionId)
  }, [rows, draft.sectionId])

  const stemDetail = useUcatQuestionDetail(editingStemId)

  const openCategoryDialog = useCallback(
    (categoryId: string) => {
      const row = rowById.get(categoryId)
      if (!row) return
      setEditingCategoryId(categoryId)
      setDraft({
        name: row.name,
        sectionId: row.section_id ?? 'none',
        parentCategoryId: row.parent_id ?? 'none',
        description: row.description,
      })
    },
    [rowById]
  )

  const handleStemClick = useCallback((stem: UcatCategoryLinkedStem) => {
    setEditingCategoryId(null)
    setEditingStemId(stem.stemId)
  }, [])

  const handleStemUpdate = useCallback(
    async (payload: UcatQuestionStemFormValues) => {
      if (!editingStemId) return
      const mapped = mapFormValuesToBundlePayload(payload, editingStemId)
      await updateStemMutation.mutateAsync({ stemId: editingStemId, payload: mapped })
      setEditingStemId(null)
      await queryClient.invalidateQueries({ queryKey: ucatKeys.categories() })
      if (editingCategoryId) {
        await queryClient.invalidateQueries({ queryKey: ucatKeys.categoryStems(editingCategoryId) })
      }
    },
    [editingCategoryId, editingStemId, queryClient, updateStemMutation]
  )

  const handleReparent = useCallback(
    async (itemId: string, target: TaxonomyReparentTarget) => {
      if (target.type === 'node' && isDescendantOf(rows, target.parentId, itemId)) {
        toast({
          title: 'Invalid move',
          description: 'Cannot move a category under its own descendant.',
          variant: 'destructive',
        })
        return
      }

      try {
        if (target.type === 'root') {
          await updateCategory.mutateAsync({
            id: itemId,
            payload: {
              reparentOnly: true,
              parentCategoryId: null,
              sectionId: target.sectionId,
            },
          })
        } else {
          const parent = rowById.get(target.parentId)
          await updateCategory.mutateAsync({
            id: itemId,
            payload: {
              reparentOnly: true,
              parentCategoryId: target.parentId,
              sectionId: parent?.section_id ?? null,
            },
          })
        }
      } catch (error) {
        toast({
          title: 'Could not move category',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    },
    [rowById, rows, toast, updateCategory]
  )

  if (access.isLoading || categories.isLoading || sections.isLoading) {
    return <UcatPageSkeleton rows={8} />
  }
  if (!access.data) return <UcatAccessDenied />

  async function create() {
    const result = await createCategory.mutateAsync({
      name: draft.name,
      description: draft.description,
      sectionId: draft.sectionId === 'none' ? null : draft.sectionId,
      parentCategoryId: draft.parentCategoryId === 'none' ? null : draft.parentCategoryId,
    })
    const categoryName = draft.name.trim() || 'Untitled'
    setCreateOpen(false)
    setDraft(emptyDraft)
    toast({
      title: `Category ${categoryName} created`,
      description: (
        <button
          type="button"
          onClick={() => openCategoryDialog(result.id)}
          className="text-left font-medium underline hover:no-underline"
        >
          View category
        </button>
      ),
    })
  }

  const isSearching = searchQuery.trim().length > 0
  const visibleSectionTrees = isSearching
    ? sectionTrees.filter((section) => section.nodes.length > 0)
    : sectionTrees
  const hasVisibleTrees = !isSearching || visibleSectionTrees.length > 0

  const sectionContent = (
    <>
      {visibleSectionTrees.map((section) => (
        <TaxonomySectionDropZone
          key={section.sectionId}
          sectionId={section.sectionId}
          sectionName={section.sectionName}
          editMode={editMode}
        >
          <TaxonomyHierarchyTree
            nodes={section.nodes}
            itemCountNoun="stem"
            onItemClick={openCategoryDialog}
            searchQuery={searchQuery}
            editMode={editMode}
          />
        </TaxonomySectionDropZone>
      ))}
    </>
  )

  const categoryOptions = mapCategoriesToOptions(categoriesQuery.data ?? []) as CategoryOption[]
  const tagOptions = mapTagsToOptions(tagsQuery.data ?? []) as TagOption[]

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="Question Stem Categories"
        description="Create and manage question stem categories"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Question Stem Categories' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant={editMode ? 'default' : 'outline'}
              onClick={() => setEditMode((prev) => !prev)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              {editMode ? 'Done reordering' : 'Edit hierarchy'}
            </Button>
            <Button onClick={() => setCreateOpen(true)}>Add Category</Button>
          </div>
        }
      />

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-8"
        />
      </div>

      <div className="space-y-6">
        {!hasVisibleTrees ? (
          <div className={tutorCardCn('p-6 text-center text-sm text-muted-foreground')}>
            No categories match your search
          </div>
        ) : editMode ? (
          <TaxonomyHierarchyDndProvider
            allNodes={flattenTaxonomyHierarchyNodes(allHierarchyNodes)}
            onReparent={handleReparent}
          >
            <div className="space-y-6">{sectionContent}</div>
          </TaxonomyHierarchyDndProvider>
        ) : (
          <div className="space-y-6">{sectionContent}</div>
        )}
      </div>

      <UcatDialogShell
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setDraft(emptyDraft)
        }}
        title="Create Category"
        subtitle="Add a new question stem category"
        onSave={create}
        saveLabel="Create"
        saveDisabled={createCategory.isPending}
        isSaving={createCategory.isPending}
      >
        <div className="h-full overflow-y-auto p-6">
          <CategoryCreateForm
            draft={draft}
            setDraft={setDraft}
            sections={sections.data ?? []}
            parentOptions={createParentOptions}
            categoryPathLookup={categoryPathLookup}
            onSectionChange={() => setDraft((prev) => ({ ...prev, parentCategoryId: 'none' }))}
          />
        </div>
      </UcatDialogShell>

      <UcatQuestionStemCategoryDialog
        open={!!editingCategory}
        category={editingCategory}
        allCategories={rows}
        sections={sections.data ?? []}
        draft={draft}
        setDraft={setDraft}
        onClose={() => {
          setEditingCategoryId(null)
          setDraft(emptyDraft)
        }}
        onDelete={() => {
          if (editingCategory) setDeletingCategoryId(editingCategory.id)
        }}
        onStemClick={handleStemClick}
      />

      <UcatDeleteConfirmDialog
        open={!!deletingCategoryId}
        onOpenChange={(open) => !open && setDeletingCategoryId(null)}
        title="Delete category?"
        description="This action cannot be undone."
        onConfirm={async () => {
          if (!deletingCategoryId) return
          await deleteCategory.mutateAsync(deletingCategoryId)
          if (editingCategoryId === deletingCategoryId) {
            setEditingCategoryId(null)
            setDraft(emptyDraft)
          }
        }}
        isPending={deleteCategory.isPending}
      />

      <UcatQuestionStemDialog
        open={!!editingStemId}
        title="Edit Question Stem"
        submitLabel="Save"
        onClose={() => setEditingStemId(null)}
        onSubmit={handleStemUpdate}
        sections={(sections.data ?? []).map((section) => ({
          id: section.id,
          name: section.name,
          display_columns: section.display_columns,
        }))}
        categories={categoryOptions}
        tags={tagOptions}
        initial={stemDetail.data}
        loading={updateStemMutation.isPending || stemDetail.isLoading}
      />
    </div>
  )
}
