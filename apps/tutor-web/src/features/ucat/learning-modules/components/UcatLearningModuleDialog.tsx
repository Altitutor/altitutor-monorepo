'use client'

import { ExternalLink, Trash2 } from 'lucide-react'
import { useToast } from '@altitutor/ui'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatLearningModuleEditorShell } from '@/features/ucat/learning-modules/components/UcatLearningModuleEditorShell'
import { useLearningModuleEditor } from '@/features/ucat/learning-modules/hooks/useLearningModuleEditor'

type UcatLearningModuleDialogProps = {
  open: boolean
  moduleId: string | null
  onClose: () => void
  onDeleted?: () => void
}

export function UcatLearningModuleDialog({
  open,
  moduleId,
  onClose,
  onDeleted,
}: UcatLearningModuleDialogProps) {
  const { toast } = useToast()
  const editor = useLearningModuleEditor(open ? moduleId : null)

  const title = editor.title.trim() || editor.moduleQuery.data?.title || 'Learning module'

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
    if (!moduleId) return
    try {
      await editor.saveAll()
    } catch (e) {
      toast({ title: 'Save failed', description: String(e), variant: 'destructive' })
    }
  }

  async function handleDelete() {
    if (!moduleId) return
    if (!window.confirm('Delete this learning module? This cannot be undone.')) return
    try {
      await editor.handleDelete()
      onDeleted?.()
      onClose()
    } catch (e) {
      toast({ title: 'Delete failed', description: String(e), variant: 'destructive' })
    }
  }

  const headerActions = moduleId ? (
    <UcatRowActions
      actions={[
        {
          label: 'Open in page',
          icon: <ExternalLink className="h-4 w-4" />,
          href: `/ucat/learning-modules/${moduleId}`,
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

  if (!moduleId) return null

  return (
    <UcatDialogShell
      open={open}
      onClose={handleRequestClose}
      title={title}
      subtitle="Edit lesson blocks and module settings"
      onSave={handleSave}
      saveLabel="Save"
      saveDisabled={!editor.hasUnsavedChanges}
      isSaving={editor.isSaving}
      hideCancel
      headerActions={headerActions}
      defaultExpanded
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <UcatLearningModuleEditorShell editor={editor} hasUcatAccess />
      </div>
    </UcatDialogShell>
  )
}
