'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useRouter } from 'next/navigation'
import { Button, useToast } from '@altitutor/ui'
import { UcatAccessDenied } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { TutorPageContainer } from '@/shared/components/layouts'
import {
  useDeleteUcatLearningModule,
  useUcatLearningModule,
  useUcatLearningModules,
} from '@/features/ucat/learning-modules/hooks/useUcatLearningModules'
import { UcatLearningModuleDialog } from '@/features/ucat/learning-modules/components/UcatLearningModuleDialog'
import { UcatLearningModuleFolderDialog } from '@/features/ucat/learning-modules/components/UcatLearningModuleFolderDialog'
import { UcatLearningModuleEditorShell } from '@/features/ucat/learning-modules/components/UcatLearningModuleEditorShell'
import { UcatRichTextFloatingToolbar } from '@/features/ucat/shared/components/UcatRichTextFloatingToolbar'
import { useLearningModuleEditor } from '@/features/ucat/learning-modules/hooks/useLearningModuleEditor'
import { useUcatSections } from '@/features/ucat/questions/hooks/useUcatQuestions'
import { lifecycleErrorToast } from '@/features/ucat/shared/lifecycle-errors'

export function UcatLearningModuleDetailPage({ moduleId }: { moduleId: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const access = useUcatAccess()
  const hasUcatAccess = Boolean(access.data)
  const moduleQuery = useUcatLearningModule(moduleId)
  const modulesQuery = useUcatLearningModules()
  const sectionsQuery = useUcatSections()
  const deleteModule = useDeleteUcatLearningModule()
  const editor = useLearningModuleEditor(moduleId)
  const [dialogOpen, setDialogOpen] = useState(true)
  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)

  const activeModules = useMemo(
    () => (modulesQuery.data ?? []).filter((row) => row.deleted_at == null),
    [modulesQuery.data],
  )
  const isFolder = moduleQuery.data?.kind === 'folder'

  useEffect(() => {
    setDialogOpen(true)
  }, [moduleId])

  async function handleDeleteFolder(folderId: string) {
    const row = moduleQuery.data
    if (!row || row.kind !== 'folder') return
    if (!window.confirm('Delete this folder? This cannot be undone.')) return
    try {
      await deleteModule.mutateAsync(folderId)
      toast({ title: 'Deleted', description: `${row.title} was deleted.` })
      router.push('/ucat/learning-modules')
    } catch (error) {
      toast(lifecycleErrorToast(error, 'Delete failed', router.push))
    }
  }

  if (access.isLoading || moduleQuery.isLoading) return null
  if (!hasUcatAccess) return <UcatAccessDenied />
  if (!moduleQuery.data) {
    return (
      <TutorPageContainer>
        <p className="text-muted-foreground">Module not found.</p>
      </TutorPageContainer>
    )
  }

  if (dialogOpen && isFolder) {
    return (
      <UcatLearningModuleFolderDialog
        open={dialogOpen}
        folderId={moduleId}
        modules={activeModules}
        sections={sectionsQuery.data ?? []}
        onClose={() => {
          setDialogOpen(false)
          router.push('/ucat/learning-modules')
        }}
        onDelete={handleDeleteFolder}
      />
    )
  }

  if (dialogOpen) {
    return (
      <UcatLearningModuleDialog
        open={dialogOpen}
        moduleId={moduleId}
        onClose={() => {
          setDialogOpen(false)
          router.push('/ucat/learning-modules')
        }}
        onDeleted={() => router.push('/ucat/learning-modules')}
      />
    )
  }

  if (isFolder) {
    return (
      <TutorPageContainer>
        <p className="text-muted-foreground">Open the folder dialog to edit folder properties.</p>
        <Button type="button" className="mt-4" onClick={() => setDialogOpen(true)}>
          Edit folder
        </Button>
      </TutorPageContainer>
    )
  }

  return (
    <TutorPageContainer className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{editor.title || 'Learning module'}</h1>
          <p className="text-sm text-muted-foreground">Full-page editor</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => setDialogOpen(true)}>
            Open in dialog
          </Button>
          <Button
            type="button"
            onClick={() => {
              void editor.saveAll().catch((error) => {
                toast({
                  title: 'Save failed',
                  description: error instanceof Error ? error.message : String(error),
                  variant: 'destructive',
                })
              })
            }}
            disabled={!editor.hasUnsavedChanges || editor.isSaving}
          >
            {editor.isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      <div className="relative flex min-h-[70vh] flex-1 flex-col">
        <UcatLearningModuleEditorShell
          editor={editor}
          hasUcatAccess={hasUcatAccess}
          onActiveTextEditorChange={setActiveTextEditor}
        />
        <UcatRichTextFloatingToolbar editor={activeTextEditor} />
      </div>
    </TutorPageContainer>
  )
}
