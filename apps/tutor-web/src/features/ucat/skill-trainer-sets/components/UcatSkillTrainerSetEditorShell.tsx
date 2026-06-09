'use client'

import { useMemo, useState } from 'react'
import type { UcatSkillTrainerKey } from '@altitutor/shared'
import { useToast } from '@altitutor/ui'
import { UcatSkillTrainerItemDialog } from '@/features/ucat/skill-trainer/components/UcatSkillTrainerItemDialog'
import {
  useSetUcatSkillTrainerItemApproval,
  useUcatSkillTrainerItem,
  useUpsertUcatSkillTrainerItem,
} from '@/features/ucat/skill-trainer/hooks/useUcatSkillTrainerItems'
import type { useSkillTrainerSetEditor } from '@/features/ucat/skill-trainer-sets/hooks/useSkillTrainerSetEditor'
import { UcatSkillTrainerSetEditorContent } from '@/features/ucat/skill-trainer-sets/components/UcatSkillTrainerSetEditorContent'

type SkillTrainerSetEditor = ReturnType<typeof useSkillTrainerSetEditor>

type UcatSkillTrainerSetEditorShellProps = {
  editor: SkillTrainerSetEditor
}

export function UcatSkillTrainerSetEditorShell({ editor }: UcatSkillTrainerSetEditorShellProps) {
  const { toast } = useToast()
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const editingItem = useUcatSkillTrainerItem(editingItemId)
  const upsertItem = useUpsertUcatSkillTrainerItem()
  const setApproval = useSetUcatSkillTrainerItemApproval()

  const trainerName = useMemo(
    () => editor.trainers.find((t) => t.id === editor.trainerId)?.name ?? 'Trainer',
    [editor.trainers, editor.trainerId],
  )

  const trainerKey = useMemo(
    () => (editor.trainers.find((t) => t.id === editor.trainerId)?.key ?? 'quick_syllogism') as UcatSkillTrainerKey,
    [editor.trainers, editor.trainerId],
  )

  async function handleSaveItem(payload: {
    itemId?: string | null
    skillTrainerId: string
    content: Record<string, unknown>
    isActive: boolean
  }) {
    const id = await upsertItem.mutateAsync(payload)
    toast({ title: 'Saved', description: 'Skill trainer question saved.' })
    setEditingItemId(id)
    await Promise.all([editor.itemsQuery.refetch(), editor.refetchTrainerItems()])
  }

  async function handleApproval(status: 'approved' | 'pending' | 'rejected') {
    if (!editingItemId) return
    await setApproval.mutateAsync({ itemId: editingItemId, approvalStatus: status })
    toast({ title: 'Approval updated', description: `Question marked as ${status}.` })
    await Promise.all([editingItem.refetch(), editor.itemsQuery.refetch(), editor.refetchTrainerItems()])
  }

  return (
    <>
      <UcatSkillTrainerSetEditorContent
        name={editor.name}
        description={editor.description}
        trainerName={trainerName}
        isPrivate={editor.isPrivate}
        itemIds={editor.itemIds}
        onItemIdsChange={editor.setItemIds}
        onAddItem={editor.addItem}
        onRemoveItem={editor.removeItem}
        trainerItems={editor.trainerItems}
        unusedItems={editor.unusedItems}
        onChangeName={editor.setName}
        onChangeDescription={editor.setDescription}
        onChangePrivate={editor.setIsPrivate}
        onEditItem={setEditingItemId}
      />

      <UcatSkillTrainerItemDialog
        open={!!editingItemId}
        title="Edit skill trainer question"
        submitLabel="Save"
        onClose={() => setEditingItemId(null)}
        onSubmit={handleSaveItem}
        onApprovalChange={handleApproval}
        trainers={editor.trainers}
        trainerKey={trainerKey}
        initial={editingItem.data ?? null}
        loading={upsertItem.isPending || editingItem.isLoading}
      />
    </>
  )
}
