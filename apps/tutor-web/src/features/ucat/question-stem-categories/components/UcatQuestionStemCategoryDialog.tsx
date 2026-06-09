'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Json } from '@altitutor/shared'
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
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import {
  buildTaxonomyPathLookup,
  categoriesToTaxonomyNodes,
  taxonomyDisplayLabel,
} from '@/features/ucat/shared/lib/taxonomy-paths'
import {
  useUcatCategoryLinkedStems,
  useUpdateUcatQuestionStemCategory,
} from '@/features/ucat/question-stem-categories/hooks/useUcatQuestionStemCategories'
import { LinkedResourceCatalog } from '@/features/ucat/shared/components/linked-resource-catalog'
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
  const updateCategory = useUpdateUcatQuestionStemCategory()
  const linkedStems = useUcatCategoryLinkedStems(category?.id ?? null)

  useEffect(() => {
    if (open) {
      setActiveTab('edit')
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

  const dialogTitle = category
    ? categoryPathLookup.get(category.id) ?? category.name
    : 'Category'

  const catalogItems = useMemo(() => {
    return (linkedStems.data ?? []).map((stem) => {
      const preview = proseMirrorToPlainText(stem.stemText as Json | undefined)
      return {
        id: stem.stemId,
        title: preview || stem.stemId,
        sectionName: stem.sectionName,
      }
    })
  }, [linkedStems.data])

  const sectionOptions = useMemo(
    () =>
      sections
        .filter((section): section is { id: string; name: string } => !!section.id && !!section.name)
        .map((section) => ({ id: section.id, name: section.name })),
    [sections]
  )

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
            className="mt-4 min-h-0 flex-1 overflow-hidden"
          >
            <LinkedResourceCatalog
              items={catalogItems}
              isLoading={linkedStems.isLoading}
              emptyMessage="No question stems are linked to this category."
              searchPlaceholder="Search stems..."
              sectionOptions={sectionOptions}
              onItemClick={(stemId) => {
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
