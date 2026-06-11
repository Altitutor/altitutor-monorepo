'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@altitutor/ui'
import { UcatAccessDenied } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { TutorPageContainer } from '@/shared/components/layouts'
import { useUcatLearningModule } from '@/features/ucat/learning-modules/hooks/useUcatLearningModules'
import { UcatLearningModuleDialog } from '@/features/ucat/learning-modules/components/UcatLearningModuleDialog'
import { UcatLearningModuleEditorShell } from '@/features/ucat/learning-modules/components/UcatLearningModuleEditorShell'
import { useLearningModuleEditor } from '@/features/ucat/learning-modules/hooks/useLearningModuleEditor'

export function UcatLearningModuleDetailPage({ moduleId }: { moduleId: string }) {
  const router = useRouter()
  const access = useUcatAccess()
  const hasUcatAccess = Boolean(access.data)
  const moduleQuery = useUcatLearningModule(moduleId)
  const editor = useLearningModuleEditor(moduleId)
  const [dialogOpen, setDialogOpen] = useState(true)

  useEffect(() => {
    setDialogOpen(true)
  }, [moduleId])

  if (access.isLoading || moduleQuery.isLoading) return null
  if (!hasUcatAccess) return <UcatAccessDenied />
  if (!moduleQuery.data) {
    return (
      <TutorPageContainer>
        <p className="text-muted-foreground">Module not found.</p>
      </TutorPageContainer>
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
            onClick={() => void editor.saveAll()}
            disabled={!editor.hasUnsavedChanges || editor.isSaving}
          >
            {editor.isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      <div className="flex min-h-[70vh] flex-1 flex-col">
        <UcatLearningModuleEditorShell editor={editor} hasUcatAccess={hasUcatAccess} />
      </div>
    </TutorPageContainer>
  )
}
