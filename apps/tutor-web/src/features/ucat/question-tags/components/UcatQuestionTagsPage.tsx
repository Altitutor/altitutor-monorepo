'use client'

import { useCallback, useMemo, useState } from 'react'
import { Button, Input, SearchableSelect, Textarea, useToast } from '@altitutor/ui'
import { Pencil, Search } from 'lucide-react'
import { tutorCardCn } from '@/shared/lib/tutor-visual'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { UcatAccessDenied, UcatPageHeader, UcatPageSkeleton } from '@/features/ucat/shared/components'
import {
  useCreateUcatQuestionTag,
  useDeleteUcatQuestionTag,
  useUpdateUcatQuestionTag,
  useUcatQuestionTags,
} from '@/features/ucat/question-tags/hooks/useUcatQuestionTags'
import { UcatDeleteConfirmDialog } from '@/features/ucat/shared/delete-confirm-dialog'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { UcatQuestionTagDialog } from '@/features/ucat/question-tags/components/UcatQuestionTagDialog'
import {
  buildTagSectionTreeNodes,
  filterTagTreeNodes,
} from '@/features/ucat/question-tags/lib/build-tag-tree'
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
import type {
  UcatQuestionTagDraft,
  UcatQuestionTagRow,
  UcatTagLinkedQuestion,
} from '@/features/ucat/question-tags/types'
import {
  buildTaxonomyPathLookup,
  mapCategoriesToOptions,
  mapTagsToOptions,
  tagsToTaxonomyNodes,
  taxonomyDisplayLabel,
} from '@/features/ucat/shared/lib/taxonomy-paths'
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

const emptyDraft: UcatQuestionTagDraft = {
  name: '',
  parentTagId: 'none',
  sectionId: 'none',
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

function TagCreateForm({
  draft,
  setDraft,
  sections,
  parentOptions,
  tagPathLookup,
}: {
  draft: UcatQuestionTagDraft
  setDraft: React.Dispatch<React.SetStateAction<UcatQuestionTagDraft>>
  sections: Array<{ id: string | null; name: string | null }>
  parentOptions: UcatQuestionTagRow[]
  tagPathLookup: Map<string, string>
}) {
  const isRoot = draft.parentTagId === 'none'
  const sectionItems = [
    { id: 'none', name: 'No section' },
    ...sections.map((section) => ({ id: section.id ?? '', name: section.name ?? 'Unknown' })),
  ]
  const selectedSection =
    sectionItems.find((section) => section.id === draft.sectionId) ?? sectionItems[0]
  const parentItems = [
    { id: 'none', name: 'No parent', label: 'No parent' },
    ...parentOptions.map((row) => ({
      id: row.id,
      name: row.name,
      label: tagPathLookup.get(row.id) ?? row.name,
    })),
  ]
  const selectedParent = parentItems.find((item) => item.id === draft.parentTagId) ?? parentItems[0]

  return (
    <div className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Name</span>
        <Input
          value={draft.name}
          onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Parent tag</span>
        <SearchableSelect<{ id: string; name: string; label: string }>
          items={parentItems}
          value={selectedParent}
          onValueChange={(item) =>
            setDraft((prev) => ({
              ...prev,
              parentTagId: item?.id ?? 'none',
              sectionId: item?.id && item.id !== 'none' ? 'none' : prev.sectionId,
            }))
          }
          getItemLabel={(item) => taxonomyDisplayLabel(item)}
          getItemId={(item) => item.id}
        />
      </label>
      {isRoot ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Section (optional)</span>
          <SearchableSelect<{ id: string; name: string }>
            items={sectionItems}
            value={selectedSection}
            onValueChange={(item) =>
              setDraft((prev) => ({ ...prev, sectionId: item?.id ?? 'none' }))
            }
            getItemLabel={(section) => section.name}
            getItemId={(section) => section.id}
          />
        </label>
      ) : null}
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

export function UcatQuestionTagsPage() {
  const access = useUcatAccess()
  const tags = useUcatQuestionTags()
  const sections = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const createTag = useCreateUcatQuestionTag()
  const updateTag = useUpdateUcatQuestionTag()
  const deleteTag = useDeleteUcatQuestionTag()
  const updateStemMutation = useUpdateUcatQuestionStem()

  const [searchQuery, setSearchQuery] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [editingTagId, setEditingTagId] = useState<string | null>(null)
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null)
  const [draft, setDraft] = useState<UcatQuestionTagDraft>(emptyDraft)
  const [editingStemId, setEditingStemId] = useState<string | null>(null)
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null)

  const rows: UcatQuestionTagRow[] = useMemo(() => {
    const data = tags.data ?? []
    return data.map((tag) => {
      const row = tag as typeof tag & { question_count?: number }
      return {
        id: row.id ?? '',
        name: row.name ?? '-',
        parent_id: row.parent_question_tag_id,
        section_id: row.ucat_section_id ?? null,
        description: proseMirrorToPlainText(row.description),
        question_count: row.question_count ?? 0,
      }
    })
  }, [tags.data])

  const rowById = useMemo(() => new Map(rows.map((row) => [row.id, row])), [rows])

  const editingTag = editingTagId ? (rowById.get(editingTagId) ?? null) : null

  const sectionTrees = useMemo(() => {
    const sectionList = [...(sections.data ?? [])].sort(
      (a, b) => (a.section_number ?? 0) - (b.section_number ?? 0)
    )

    return sectionList.map((section) => {
      const rootNodes = buildTagSectionTreeNodes(rows, section.id ?? '')
      const filtered = filterTagTreeNodes(rootNodes, searchQuery)
      return {
        sectionId: section.id ?? '',
        sectionName: section.name ?? 'Unknown section',
        nodes: mapToTaxonomyHierarchyNodes(filtered, 'question_count'),
      }
    })
  }, [rows, searchQuery, sections.data])

  const unsectionedTrees = useMemo(() => {
    const rootNodes = buildTagSectionTreeNodes(rows, null)
    const filtered = filterTagTreeNodes(rootNodes, searchQuery)
    return mapToTaxonomyHierarchyNodes(filtered, 'question_count')
  }, [rows, searchQuery])

  const allHierarchyNodes = useMemo(
    () => [
      ...sectionTrees.flatMap((section) => section.nodes),
      ...unsectionedTrees,
    ],
    [sectionTrees, unsectionedTrees]
  )

  const parentOptions = useMemo(() => rows, [rows])
  const tagPathLookup = useMemo(
    () =>
      buildTaxonomyPathLookup(
        tagsToTaxonomyNodes(
          rows.map((row) => ({
            id: row.id,
            name: row.name,
            parent_question_tag_id: row.parent_id,
          }))
        )
      ),
    [rows]
  )

  const stemDetail = useUcatQuestionDetail(editingStemId)

  const openTagDialog = useCallback(
    (tagId: string) => {
      const row = rowById.get(tagId)
      if (!row) return
      setEditingTagId(tagId)
      setDraft({
        name: row.name,
        parentTagId: row.parent_id ?? 'none',
        sectionId: row.section_id ?? 'none',
        description: row.description,
      })
    },
    [rowById]
  )

  const handleQuestionClick = useCallback((question: UcatTagLinkedQuestion) => {
    setEditingTagId(null)
    setEditingStemId(question.stemId)
    setEditingQuestionIndex(question.questionIndex - 1)
  }, [])

  const handleStemUpdate = useCallback(
    async (payload: UcatQuestionStemFormValues) => {
      if (!editingStemId) return
      const mapped = mapFormValuesToBundlePayload(payload, editingStemId)
      await updateStemMutation.mutateAsync({ stemId: editingStemId, payload: mapped })
      setEditingStemId(null)
      setEditingQuestionIndex(null)
      await queryClient.invalidateQueries({ queryKey: ucatKeys.tags() })
      if (editingTagId) {
        await queryClient.invalidateQueries({ queryKey: ucatKeys.tagQuestions(editingTagId) })
      }
    },
    [editingStemId, editingTagId, queryClient, updateStemMutation]
  )

  const handleReparent = useCallback(
    async (itemId: string, target: TaxonomyReparentTarget) => {
      if (target.type === 'node' && isDescendantOf(rows, target.parentId, itemId)) {
        toast({
          title: 'Invalid move',
          description: 'Cannot move a tag under its own descendant.',
          variant: 'destructive',
        })
        return
      }

      try {
        if (target.type === 'root') {
          await updateTag.mutateAsync({
            id: itemId,
            payload: {
              reparentOnly: true,
              parentTagId: null,
              sectionId: target.sectionId,
            },
          })
        } else {
          await updateTag.mutateAsync({
            id: itemId,
            payload: {
              reparentOnly: true,
              parentTagId: target.parentId,
              sectionId: null,
            },
          })
        }
      } catch (error) {
        toast({
          title: 'Could not move tag',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        })
      }
    },
    [rows, toast, updateTag]
  )

  if (access.isLoading || tags.isLoading || sections.isLoading) return <UcatPageSkeleton rows={8} />
  if (!access.data) return <UcatAccessDenied />

  async function create() {
    const result = await createTag.mutateAsync({
      name: draft.name,
      description: draft.description,
      parentTagId: draft.parentTagId === 'none' ? null : draft.parentTagId,
      sectionId:
        draft.parentTagId === 'none' && draft.sectionId !== 'none' ? draft.sectionId : null,
    })
    const tagName = draft.name.trim() || 'Untitled'
    const createdRow: UcatQuestionTagRow = {
      id: result.id,
      name: draft.name,
      parent_id: draft.parentTagId === 'none' ? null : draft.parentTagId,
      section_id:
        draft.parentTagId === 'none' && draft.sectionId !== 'none' ? draft.sectionId : null,
      description: draft.description,
      question_count: 0,
    }
    setCreateOpen(false)
    setDraft(emptyDraft)
    toast({
      title: `Tag ${tagName} created`,
      description: (
        <button
          type="button"
          onClick={() => openTagDialog(createdRow.id)}
          className="text-left font-medium underline hover:no-underline"
        >
          View tag
        </button>
      ),
    })
  }

  const isSearching = searchQuery.trim().length > 0
  const visibleSectionTrees = isSearching
    ? sectionTrees.filter((section) => section.nodes.length > 0)
    : sectionTrees
  const showOtherTags = !isSearching || unsectionedTrees.length > 0
  const hasVisibleTrees =
    !isSearching ||
    visibleSectionTrees.length > 0 ||
    unsectionedTrees.length > 0

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
            itemCountNoun="question"
            onItemClick={openTagDialog}
            searchQuery={searchQuery}
            editMode={editMode}
          />
        </TaxonomySectionDropZone>
      ))}

      {showOtherTags ? (
        <TaxonomySectionDropZone
          sectionId={null}
          sectionName="Other tags"
          editMode={editMode}
        >
          <TaxonomyHierarchyTree
            nodes={unsectionedTrees}
            itemCountNoun="question"
            onItemClick={openTagDialog}
            searchQuery={searchQuery}
            editMode={editMode}
          />
        </TaxonomySectionDropZone>
      ) : null}
    </>
  )

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="Question Tags"
        description="Create and manage reusable question tags"
        backHref="/ucat"
        breadcrumbs={[{ label: 'UCAT', href: '/ucat' }, { label: 'Question Tags' }]}
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
            <Button onClick={() => setCreateOpen(true)}>Add Tag</Button>
          </div>
        }
      />

      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Search tags..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="pl-8"
        />
      </div>

      <div className="space-y-6">
        {!hasVisibleTrees ? (
          <div className={tutorCardCn('p-6 text-center text-sm text-muted-foreground')}>
            No tags match your search
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
        title="Create Tag"
        subtitle="Add a new question tag"
        onSave={create}
        saveLabel="Create"
        saveDisabled={createTag.isPending}
        isSaving={createTag.isPending}
      >
        <div className="h-full overflow-y-auto p-6">
          <TagCreateForm
            draft={draft}
            setDraft={setDraft}
            sections={sections.data ?? []}
            parentOptions={parentOptions}
            tagPathLookup={tagPathLookup}
          />
        </div>
      </UcatDialogShell>

      <UcatQuestionTagDialog
        open={!!editingTag}
        tag={editingTag}
        allTags={rows}
        sections={sections.data ?? []}
        draft={draft}
        setDraft={setDraft}
        onClose={() => {
          setEditingTagId(null)
          setDraft(emptyDraft)
        }}
        onDelete={() => {
          if (editingTag) setDeletingTagId(editingTag.id)
        }}
        onQuestionClick={handleQuestionClick}
      />

      <UcatDeleteConfirmDialog
        open={!!deletingTagId}
        onOpenChange={(open) => !open && setDeletingTagId(null)}
        title="Delete tag?"
        description="This action cannot be undone."
        onConfirm={async () => {
          if (!deletingTagId) return
          await deleteTag.mutateAsync(deletingTagId)
          if (editingTagId === deletingTagId) {
            setEditingTagId(null)
            setDraft(emptyDraft)
          }
        }}
        isPending={deleteTag.isPending}
      />

      <UcatQuestionStemDialog
        open={!!editingStemId}
        title="Edit Question Stem"
        submitLabel="Save"
        onClose={() => {
          setEditingStemId(null)
          setEditingQuestionIndex(null)
        }}
        onSubmit={handleStemUpdate}
        sections={(sections.data ?? []).map((section) => ({
          id: section.id,
          name: section.name,
          display_columns: section.display_columns,
        }))}
        categories={mapCategoriesToOptions(categoriesQuery.data ?? []) as CategoryOption[]}
        tags={mapTagsToOptions(tagsQuery.data ?? []) as TagOption[]}
        initial={stemDetail.data}
        loading={updateStemMutation.isPending || stemDetail.isLoading}
        initialQuestionIndex={editingQuestionIndex ?? undefined}
      />
    </div>
  )
}
