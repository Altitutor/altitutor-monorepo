'use client'

import { useEffect, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { CheckCircle2, ExternalLink, FilePenLine, ListChecks, Send, Trash2 } from 'lucide-react'
import { useToast } from '@altitutor/ui'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { useUcatCopyId } from '@/features/ucat/shared/hooks/useUcatCopyId'
import { buildCopyIdRowAction, summarizeLearningModuleBlock, withCopyIdDescription } from '@/features/ucat/shared/lib/copy-id-actions'
import { UcatRowActions } from '@/features/ucat/shared/row-actions'
import { UcatLearningModuleEditorShell } from '@/features/ucat/learning-modules/components/UcatLearningModuleEditorShell'
import type { LearningModuleEditorMode } from '@/features/ucat/learning-modules/components/UcatLearningModuleSettingsPanel'
import { useLearningModuleEditor } from '@/features/ucat/learning-modules/hooks/useLearningModuleEditor'
import { ucatLearningModulesApi } from '@/features/ucat/learning-modules/api/modules'
import {
  lifecycleErrorToast,
  lifecycleStatusSuccessToast,
} from '@/features/ucat/shared/lifecycle-errors'
import type { UcatContentStatus } from '@/features/ucat/shared/types'
import { SegmentedControl } from '@/shared/components/segmented-control'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { ucatKeys } from '@/features/ucat/shared/lib/query-keys'

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
  const router = useRouter()
  const queryClient = useQueryClient()
  const editor = useLearningModuleEditor(open ? moduleId : null)
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)
  const [editorMode, setEditorMode] = useState<LearningModuleEditorMode>('edit')
  const [statusPending, setStatusPending] = useState(false)

  useEffect(() => {
    if (!open) {
      setActiveTextEditor(null)
      setEditorMode('edit')
      setStatusPending(false)
    }
  }, [open])

  const title = editor.title.trim() || editor.moduleQuery.data?.title || 'Learning module'
  const status = editor.status
  const isFolder = editor.kind === 'folder'

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
      onClose()
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : String(e),
        variant: 'destructive',
      })
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
      toast(lifecycleErrorToast(e, 'Delete failed', router.push))
    }
  }

  async function handleSetStatus(nextStatus: UcatContentStatus) {
    if (!moduleId || isFolder) return
    const previousStatus = status
    setStatusPending(true)
    try {
      if (editor.hasUnsavedChanges) {
        await editor.saveAll()
      }
      await ucatLearningModulesApi.setStatus(moduleId, nextStatus)
      editor.setStatus(nextStatus)
      await queryClient.invalidateQueries({ queryKey: ucatKeys.learningModules() })
      await queryClient.invalidateQueries({ queryKey: ucatKeys.learningModule(moduleId) })
      toast(
        lifecycleStatusSuccessToast({
          contentLabel: 'Lesson',
          count: 1,
          status: nextStatus,
          onUndo: () => {
            void ucatLearningModulesApi
              .bulkRestoreStatus([moduleId], nextStatus, previousStatus)
              .then(async () => {
                editor.setStatus(previousStatus)
                await queryClient.invalidateQueries({ queryKey: ucatKeys.learningModules() })
                await queryClient.invalidateQueries({ queryKey: ucatKeys.learningModule(moduleId) })
                toast({ title: 'Lesson status restored' })
              })
              .catch((error) => toast(lifecycleErrorToast(error, 'Could not undo status change', router.push)))
          },
        }),
      )
    } catch (error) {
      toast(lifecycleErrorToast(error, 'Cannot change lesson status', router.push))
    } finally {
      setStatusPending(false)
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
        ...(!isFolder && status === 'draft'
          ? [
              {
                label: 'Send for review',
                icon: <Send className="h-4 w-4" />,
                onClick: () => void handleSetStatus('in_review'),
              },
            ]
          : []),
        ...(!isFolder && status === 'in_review'
          ? [
              {
                label: 'Publish',
                icon: <CheckCircle2 className="h-4 w-4" />,
                onClick: () => void handleSetStatus('published'),
              },
              {
                label: 'Move to draft',
                icon: <FilePenLine className="h-4 w-4" />,
                onClick: () => void handleSetStatus('draft'),
              },
            ]
          : []),
        ...(!isFolder && status === 'published'
          ? [
              {
                label: 'Move to review',
                icon: <ListChecks className="h-4 w-4" />,
                onClick: () => void handleSetStatus('in_review'),
              },
              {
                label: 'Move to draft',
                icon: <FilePenLine className="h-4 w-4" />,
                onClick: () => void handleSetStatus('draft'),
              },
            ]
          : []),
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
      subtitle={isFolder ? 'Edit folder settings' : 'Edit lesson blocks and module settings'}
      onSave={handleSave}
      saveLabel="Save"
      saveDisabled={false}
      isSaving={editor.isSaving}
      hideCancel
      headerControls={
        <SegmentedControl
          value={editorMode}
          onValueChange={setEditorMode}
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'view', label: 'View' },
          ]}
        />
      }
      headerActions={headerActions}
      defaultExpanded
      mobileFullscreen
      richTextToolbarEditor={activeTextEditor}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <UcatLearningModuleEditorShell
          editor={editor}
          hasUcatAccess
          editorMode={editorMode}
          onEditorModeChange={setEditorMode}
          showModeControls={false}
          onActiveTextEditorChange={setActiveTextEditor}
        />
      </div>
    </UcatDialogShell>
  )
}
