'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Input,
  SearchableSelect,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@altitutor/ui'
import { Trash2 } from 'lucide-react'
import { cn } from '@/shared/utils'
import { tutorTabsList, tutorTabsTrigger } from '@/shared/lib/tutor-visual'
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

type UcatQuestionTagDialogProps = {
  open: boolean
  tag: UcatQuestionTagRow | null
  allTags: UcatQuestionTagRow[]
  draft: UcatQuestionTagDraft
  setDraft: React.Dispatch<React.SetStateAction<UcatQuestionTagDraft>>
  onClose: () => void
  onDelete: () => void
  onQuestionClick: (question: UcatTagLinkedQuestion) => void
}

function TagEditForm({
  draft,
  setDraft,
  parentOptions,
}: {
  draft: UcatQuestionTagDraft
  setDraft: React.Dispatch<React.SetStateAction<UcatQuestionTagDraft>>
  parentOptions: UcatQuestionTagRow[]
}) {
  const parentItems = useMemo(
    () => [{ id: 'none', name: 'No parent' }, ...parentOptions.map((row) => ({ id: row.id, name: row.name }))],
    [parentOptions]
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
        <SearchableSelect<{ id: string; name: string }>
          items={parentItems}
          value={selectedParent}
          onValueChange={(item) =>
            setDraft((prev) => ({ ...prev, parentTagId: item?.id ?? 'none' }))
          }
          getItemLabel={(item) => item.name}
          getItemId={(item) => item.id}
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

function LinkedQuestionsList({
  questions,
  isLoading,
  onQuestionClick,
}: {
  questions: UcatTagLinkedQuestion[]
  isLoading: boolean
  onQuestionClick: (question: UcatTagLinkedQuestion) => void
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (!questions.length) {
    return <p className="text-sm text-muted-foreground">No questions are linked to this tag.</p>
  }

  return (
    <ul className="space-y-1.5">
      {questions.map((question) => {
        const preview = proseMirrorToPlainText(question.questionText as Json | undefined)
        const label = `${question.sectionName} · Q${question.questionIndex}${preview ? ` · ${preview}` : ''}`
        return (
          <li key={question.questionId}>
            <button
              type="button"
              onClick={() => onQuestionClick(question)}
              className="flex w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors duration-300 hover:bg-muted/80"
            >
              <span className="line-clamp-2" title={label}>
                {label}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function UcatQuestionTagDialog({
  open,
  tag,
  allTags,
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

  async function saveEdit() {
    if (!tag) return
    await updateTag.mutateAsync({
      id: tag.id,
      payload: {
        name: draft.name,
        description: draft.description,
        parentTagId: draft.parentTagId === 'none' ? null : draft.parentTagId,
      },
    })
    onClose()
  }

  return (
    <UcatDialogShell
      open={open}
      onClose={onClose}
      title={tag?.name ?? 'Tag'}
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
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as 'edit' | 'questions')}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className={cn(tutorTabsList, 'w-full max-w-sm')}>
            <TabsTrigger value="edit" className={cn(tutorTabsTrigger, 'flex-1')}>
              Edit
            </TabsTrigger>
            <TabsTrigger value="questions" className={cn(tutorTabsTrigger, 'flex-1')}>
              Questions
              {tag ? (
                <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                  ({tag.question_count})
                </span>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="mt-4 min-h-0 flex-1 overflow-y-auto">
            <TagEditForm draft={draft} setDraft={setDraft} parentOptions={parentOptions} />
          </TabsContent>

          <TabsContent value="questions" className="mt-4 min-h-0 flex-1 overflow-y-auto">
            <LinkedQuestionsList
              questions={linkedQuestions.data ?? []}
              isLoading={linkedQuestions.isLoading}
              onQuestionClick={onQuestionClick}
            />
          </TabsContent>
        </Tabs>
      </div>
    </UcatDialogShell>
  )
}
