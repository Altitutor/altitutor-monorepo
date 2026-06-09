'use client'

import { ExternalLink, Trash2 } from 'lucide-react'
import { useToast } from '@altitutor/ui'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatSkillTrainerSetEditorShell } from '@/features/ucat/skill-trainer-sets/components/UcatSkillTrainerSetEditorShell'
import { useSkillTrainerSetEditor } from '@/features/ucat/skill-trainer-sets/hooks/useSkillTrainerSetEditor'

type UcatSkillTrainerSetDialogProps = {
  open: boolean
  setId: string | null
  onClose: () => void
  onDeleted?: () => void
}

export function UcatSkillTrainerSetDialog({
  open,
  setId,
  onClose,
  onDeleted,
}: UcatSkillTrainerSetDialogProps) {
  const { toast } = useToast()
  const editor = useSkillTrainerSetEditor(open ? setId : null)

  const title = editor.name.trim() || editor.setQuery.data?.name || 'Skill trainer set'

  function handleRequestClose() {
    if (
      editor.hasUnsavedChanges &&
      !window.confirm('Changes made will be lost. Close without saving?')
    ) {
      return
    }
    onClose()
  }

  async function handleSave() {
    if (!setId) return
    try {
      await editor.saveAll()
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' })
    }
  }

  async function handleDelete() {
    if (!setId) return
    if (!window.confirm('Delete this skill trainer set? This cannot be undone.')) return
    try {
      await editor.handleDelete()
      onDeleted?.()
      onClose()
    } catch (e) {
      toast({ title: 'Delete failed', description: String(e), variant: 'destructive' })
    }
  }

  const headerActions = setId ? (
    <UcatRowActions
      actions={[
        {
          label: 'Open in page',
          icon: <ExternalLink className="h-4 w-4" />,
          href: `/ucat/skill-trainer-sets/${setId}`,
        },
        {
          label: 'Delete',
          icon: <Trash2 className="h-4 w-4" />,
          onClick: handleDelete,
          destructive: true,
        },
      ]}
    />
  ) : null

  if (!setId) return null

  return (
    <UcatDialogShell
      open={open}
      onClose={handleRequestClose}
      title={title}
      subtitle="Reorder questions and update set properties"
      onSave={handleSave}
      saveLabel="Save"
      saveDisabled={!editor.hasUnsavedChanges}
      isSaving={editor.isSaving}
      hideCancel
      headerActions={headerActions}
      defaultExpanded
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <UcatSkillTrainerSetEditorShell editor={editor} />
      </div>
    </UcatDialogShell>
  )
}
