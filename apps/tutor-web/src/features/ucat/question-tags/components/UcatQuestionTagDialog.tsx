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
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { Json } from '@altitutor/shared'
import {
  useUcatTagLinkedQuestions,
  useUpdateUcatQuestionTag,
} from '@/features/ucat/question-tags/hooks/useUcatQuestionTags'
import type {
  UcatQuestionTagDraft,
  UcatQuestionTagRow,
  UcatTagLinkedQuestion,
} from '@/features/ucat/question-tags/types'
import {
  buildTaxonomyPathLookup,
  tagsToTaxonomyNodes,
  taxonomyDisplayLabel,
} from '@/features/ucat/shared/lib/taxonomy-paths'
import { LinkedResourceCatalog } from '@/features/ucat/shared/components/linked-resource-catalog'

type UcatQuestionTagDialogProps = {
  open: boolean
  tag: UcatQuestionTagRow | null
  allTags: UcatQuestionTagRow[]
  sections: Array<{ id: string | null; name: string | null }>
  draft: UcatQuestionTagDraft
  setDraft: React.Dispatch<React.SetStateAction<UcatQuestionTagDraft>>
  onClose: () => void
  onDelete: () => void
  onQuestionClick: (question: UcatTagLinkedQuestion) => void
}

function TagEditForm({
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
  const sectionItems = useMemo(
    () => [
      { id: 'none', name: 'No section' },
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
        label: tagPathLookup.get(row.id) ?? row.name,
      })),
    ],
    [parentOptions, tagPathLookup]
  )
  const selectedParent =
    parentItems.find((item) => item.id === draft.parentTagId) ?? parentItems[0]

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

export function UcatQuestionTagDialog({
  open,
  tag,
  allTags,
  sections,
  draft,
  setDraft,
  onClose,
  onDelete,
  onQuestionClick,
}: UcatQuestionTagDialogProps) {
  const [activeTab, setActiveTab] = useState<'edit' | 'questions'>('edit')
  const updateTag = useUpdateUcatQuestionTag()
  const linkedQuestions = useUcatTagLinkedQuestions(tag?.id ?? null)

  useEffect(() => {
    if (open) {
      setActiveTab('edit')
    }
  }, [open, tag?.id])

  const parentOptions = useMemo(
    () => allTags.filter((row) => row.id !== tag?.id),
    [allTags, tag?.id]
  )
  const tagPathLookup = useMemo(
    () =>
      buildTaxonomyPathLookup(
        tagsToTaxonomyNodes(
          allTags.map((row) => ({
            id: row.id,
            name: row.name,
            parent_question_tag_id: row.parent_id,
          }))
        )
      ),
    [allTags]
  )

  const dialogTitle = tag ? tagPathLookup.get(tag.id) ?? tag.name : 'Tag'

  const catalogItems = useMemo(() => {
    return (linkedQuestions.data ?? []).map((question) => {
      const preview = proseMirrorToPlainText(question.questionText as Json | undefined)
      return {
        id: question.questionId,
        title: preview || `Question ${question.questionIndex}`,
        subtitle: `Q${question.questionIndex}`,
        sectionName: question.sectionName,
      }
    })
  }, [linkedQuestions.data])

  const sectionOptions = useMemo(
    () =>
      sections
        .filter((section): section is { id: string; name: string } => !!section.id && !!section.name)
        .map((section) => ({ id: section.id, name: section.name })),
    [sections]
  )

  async function saveEdit() {
    if (!tag) return
    await updateTag.mutateAsync({
      id: tag.id,
      payload: {
        name: draft.name,
        description: draft.description,
        parentTagId: draft.parentTagId === 'none' ? null : draft.parentTagId,
        sectionId:
          draft.parentTagId === 'none'
            ? draft.sectionId === 'none'
              ? null
              : draft.sectionId
            : null,
      },
    })
    onClose()
  }

  return (
    <UcatDialogShell
      open={open}
      onClose={onClose}
      title={dialogTitle ?? 'Tag'}
      subtitle="Edit tag details or review linked questions"
      onSave={activeTab === 'edit' ? saveEdit : undefined}
      saveLabel="Save"
      saveDisabled={updateTag.isPending}
      isSaving={updateTag.isPending}
      headerActions={
        tag ? (
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
          onValueChange={(value) => setActiveTab(value as 'edit' | 'questions')}
          className="min-h-0 flex-1"
          selectorClassName="max-w-sm"
          options={[
            { value: 'edit', label: 'Edit' },
            {
              value: 'questions',
              label: tag ? `Questions (${tag.question_count})` : 'Questions',
            },
          ]}
        >
          <SegmentedTabPanelContent
            when="edit"
            activeTab={activeTab}
            className="mt-4 min-h-0 flex-1 overflow-y-auto"
          >
            <TagEditForm
              draft={draft}
              setDraft={setDraft}
              sections={sections}
              parentOptions={parentOptions}
              tagPathLookup={tagPathLookup}
            />
          </SegmentedTabPanelContent>

          <SegmentedTabPanelContent
            when="questions"
            activeTab={activeTab}
            className="mt-4 min-h-0 flex-1 overflow-hidden"
          >
            <LinkedResourceCatalog
              items={catalogItems}
              isLoading={linkedQuestions.isLoading}
              emptyMessage="No questions are linked to this tag."
              searchPlaceholder="Search questions..."
              sectionOptions={sectionOptions}
              onItemClick={(questionId) => {
                const question = (linkedQuestions.data ?? []).find(
                  (row) => row.questionId === questionId
                )
                if (question) onQuestionClick(question)
              }}
            />
          </SegmentedTabPanelContent>
        </SegmentedTabPanel>
      </div>
    </UcatDialogShell>
  )
}
