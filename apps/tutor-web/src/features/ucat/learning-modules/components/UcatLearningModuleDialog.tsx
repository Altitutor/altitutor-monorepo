'use client'

import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { ExternalLink, Trash2 } from 'lucide-react'
import { useToast } from '@altitutor/ui'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { useUcatCopyId } from '@/features/ucat/shared/hooks/useUcatCopyId'
import { buildCopyIdRowAction, summarizeLearningModuleBlock, withCopyIdDescription } from '@/features/ucat/shared/lib/copy-id-actions'
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
  const { copyId } = useUcatCopyId()
  const editor = useLearningModuleEditor(open ? moduleId : null)
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)

  useEffect(() => {
    if (!open) setActiveTextEditor(null)
  }, [open])

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

  const copyIdAction =
    moduleId != null
      ? buildCopyIdRowAction(
          [
            {
              label: 'Module',
              id: moduleId,
              description: withCopyIdDescription(editor.title.trim() || editor.moduleQuery.data?.title),
            },
            ...editor.draftBlocks.map((block, index) => ({
              label: `Block ${index + 1}`,
              id: block.clientId,
              description: summarizeLearningModuleBlock(block),
            })),
          ],
          copyId,
        )
      : null

  const headerActions = moduleId ? (
    <UcatRowActions
      actions={[
        ...(copyIdAction ? [copyIdAction] : []),
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
      richTextToolbarEditor={activeTextEditor}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <UcatLearningModuleEditorShell
          editor={editor}
          hasUcatAccess
          onActiveTextEditorChange={setActiveTextEditor}
        />
      </div>
    </UcatDialogShell>
  )
}
