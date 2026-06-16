'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Input,
  SearchableSelect,
  Textarea,
} from '@altitutor/ui'
import { Trash2 } from 'lucide-react'
import {
  SegmentedTabPanel,
  SegmentedTabPanelContent,
} from '@/shared/components/segmented-tab-panel'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { useUcatCopyId } from '@/features/ucat/shared/hooks/useUcatCopyId'
import { buildCopyIdRowAction, withCopyIdDescription } from '@/features/ucat/shared/lib/copy-id-actions'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import {
  buildTaxonomyPathLookup,
  categoriesToTaxonomyNodes,
  taxonomyDisplayLabel,
} from '@/features/ucat/shared/lib/taxonomy-paths'
import {
  useUcatCategories,
  useUcatSections,
  useUcatStemCatalog,
  useUcatTags,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { useUcatSets } from '@/features/ucat/sets/hooks/useUcatSets'
import {
  useUcatCategoryLinkedStems,
  useUpdateUcatQuestionStemCategory,
} from '@/features/ucat/question-stem-categories/hooks/useUcatQuestionStemCategories'
import { UcatStemCatalogListPanel } from '@/features/ucat/shared/components/ucat-stem-catalog-panel'
import {
  buildStemCatalogFilterDefinitions,
  buildStemCatalogSetFilterOptions,
} from '@/features/ucat/shared/lib/stem-catalog-filters'
import type {
  UcatCategoryLinkedStem,
  UcatQuestionStemCategoryDraft,
  UcatQuestionStemCategoryRow,
} from '@/features/ucat/question-stem-categories/types'

type UcatQuestionStemCategoryDialogProps = {
  open: boolean
  category: UcatQuestionStemCategoryRow | null
  allCategories: UcatQuestionStemCategoryRow[]
  sections: Array<{ id: string | null; name: string | null }>
  draft: UcatQuestionStemCategoryDraft
  setDraft: React.Dispatch<React.SetStateAction<UcatQuestionStemCategoryDraft>>
  onClose: () => void
  onDelete: () => void
  onStemClick: (stem: UcatCategoryLinkedStem) => void
}

function CategoryEditForm({
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
  const sectionItems = useMemo(
    () => [
      { id: 'none', name: 'Select section' },
      ...sections.map((section) => ({ id: section.id ?? '', name: section.name ?? 'Unknown' })),
    ],
    [sections]
  )
  const selectedSection =
    sectionItems.find((section) => section.id === draft.sectionId) ?? sectionItems[0]
  const parentItems = useMemo(
    () => [
      { id: 'none', name: 'No parent', label: 'No parent' },
      ...parentOptions.map((row) => ({
        id: row.id,
        name: row.name,
        label: categoryPathLookup.get(row.id) ?? row.name,
      })),
    ],
    [parentOptions, categoryPathLookup]
  )
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

export function UcatQuestionStemCategoryDialog({
  open,
  category,
  allCategories,
  sections,
  draft,
  setDraft,
  onClose,
  onDelete,
  onStemClick,
}: UcatQuestionStemCategoryDialogProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'stems'>('edit')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Record<string, unknown[]>>({})
  const [setFilterSearch, setSetFilterSearch] = useState('')
  const updateCategory = useUpdateUcatQuestionStemCategory()
  const { copyId } = useUcatCopyId()
  const linkedStems = useUcatCategoryLinkedStems(category?.id ?? null)
  const stemCatalogQuery = useUcatStemCatalog(open && activeTab === 'stems')
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const setsQuery = useUcatSets()

  useEffect(() => {
    if (open) {
      setActiveTab('edit')
      setSearch('')
      setFilters({})
      setSetFilterSearch('')
    }
  }, [open, category?.id])

  const parentOptions = useMemo(() => {
    if (draft.sectionId === 'none') return []
    return allCategories.filter(
      (row) => row.section_id === draft.sectionId && row.id !== category?.id
    )
  }, [allCategories, category?.id, draft.sectionId])

  const categoryPathLookup = useMemo(
    () =>
      buildTaxonomyPathLookup(
        categoriesToTaxonomyNodes(
          allCategories.map((row) => ({
            id: row.id,
            name: row.name,
            parent_question_stem_category_id: row.parent_id,
          }))
        )
      ),
    [allCategories]
  )

  const linkedStemIds = useMemo(
    () => new Set((linkedStems.data ?? []).map((stem) => stem.stemId)),
    [linkedStems.data],
  )

  const filterDefinitions = useMemo(() => {
    const setsList = (setsQuery.data ?? []).filter(
      (set) =>
        !(set as { deleted_at?: string | null }).deleted_at &&
        !(set as { is_student_generated?: boolean }).is_student_generated,
    )
    return buildStemCatalogFilterDefinitions(
      sectionsQuery.data ?? [],
      categoriesQuery.data ?? [],
      tagsQuery.data ?? [],
      filters,
      buildStemCatalogSetFilterOptions(setsList, setFilterSearch),
    )
  }, [
    sectionsQuery.data,
    categoriesQuery.data,
    tagsQuery.data,
    filters,
    setsQuery.data,
    setFilterSearch,
  ])

  const dialogTitle = category
    ? categoryPathLookup.get(category.id) ?? category.name
    : 'Category'

  async function saveEdit() {
    if (!category) return
    await updateCategory.mutateAsync({
      id: category.id,
      payload: {
        name: draft.name,
        description: draft.description,
        sectionId: draft.sectionId === 'none' ? null : draft.sectionId,
        parentCategoryId: draft.parentCategoryId === 'none' ? null : draft.parentCategoryId,
      },
    })
    onClose()
  }

  const copyIdAction =
    category != null
      ? buildCopyIdRowAction(
          [{ label: 'Category', id: category.id, description: withCopyIdDescription(category.name) }],
          copyId,
        )
      : null

  return (
    <UcatDialogShell
      open={open}
      onClose={onClose}
      title={dialogTitle ?? 'Category'}
      subtitle="Edit category details or review linked question stems"
      onSave={activeTab === 'edit' ? saveEdit : undefined}
      saveLabel="Save"
      saveDisabled={updateCategory.isPending}
      isSaving={updateCategory.isPending}
      headerActions={
        category ? (
          <UcatRowActions
            actions={[
              ...(copyIdAction ? [copyIdAction] : []),
              {
                label: 'Delete',
                icon: <Trash2 className="h-4 w-4" />,
                onClick: onDelete,
                destructive: true,
              },
            ]}
          />
        ) : null
      }
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-6">
        <SegmentedTabPanel
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'edit' | 'stems')}
          className="min-h-0 flex-1"
          selectorClassName="max-w-sm"
          options={[
            { value: 'edit', label: 'Edit' },
            {
              value: 'stems',
              label: category ? `Stems (${category.question_stem_count})` : 'Stems',
            },
          ]}
        >
          <SegmentedTabPanelContent
            when="edit"
            activeTab={activeTab}
            className="mt-4 min-h-0 flex-1 overflow-y-auto"
          >
            <CategoryEditForm
              draft={draft}
              setDraft={setDraft}
              sections={sections}
              parentOptions={parentOptions}
              categoryPathLookup={categoryPathLookup}
              onSectionChange={() => setDraft((prev) => ({ ...prev, parentCategoryId: 'none' }))}
            />
          </SegmentedTabPanelContent>

          <SegmentedTabPanelContent
            when="stems"
            activeTab={activeTab}
            className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <UcatStemCatalogListPanel
              stems={stemCatalogQuery.data ?? []}
              includedIds={linkedStemIds}
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
              isLoading={linkedStems.isLoading || stemCatalogQuery.isLoading}
              searchPlaceholder="Search stems or questions"
              emptyMessage="No question stems are linked to this category."
              onOpenStem={(stemId) => {
                const stem = (linkedStems.data ?? []).find((row) => row.stemId === stemId)
                if (stem) onStemClick(stem)
              }}
              onEditStem={(stemId) => {
                const stem = (linkedStems.data ?? []).find((row) => row.stemId === stemId)
                if (stem) onStemClick(stem)
              }}
            />
          </SegmentedTabPanelContent>
        </SegmentedTabPanel>
      </div>
    </UcatDialogShell>
  )
}
