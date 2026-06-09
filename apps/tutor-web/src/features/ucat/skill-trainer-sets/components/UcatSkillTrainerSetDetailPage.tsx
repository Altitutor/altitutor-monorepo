'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@altitutor/ui'
import { UcatAccessDenied } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { TutorPageContainer } from '@/shared/components/layouts'
import { useUcatSkillTrainerSet } from '@/features/ucat/skill-trainer-sets/hooks/useUcatSkillTrainerSets'
import { UcatSkillTrainerSetDialog } from '@/features/ucat/skill-trainer-sets/components/UcatSkillTrainerSetDialog'
import { UcatSkillTrainerSetEditorShell } from '@/features/ucat/skill-trainer-sets/components/UcatSkillTrainerSetEditorShell'
import { useSkillTrainerSetEditor } from '@/features/ucat/skill-trainer-sets/hooks/useSkillTrainerSetEditor'

export function UcatSkillTrainerSetDetailPage({ setId }: { setId: string }) {
  const router = useRouter()
  const access = useUcatAccess()
  const hasUcatAccess = Boolean(access.data)
  const setQuery = useUcatSkillTrainerSet(setId)
  const editor = useSkillTrainerSetEditor(setId)
  const [dialogOpen, setDialogOpen] = useState(true)

  useEffect(() => {
    setDialogOpen(true)
  }, [setId])

  if (access.isLoading || setQuery.isLoading) return null
  if (!hasUcatAccess) return <UcatAccessDenied />
  if (!setQuery.data) {
    return (
      <TutorPageContainer>
        <p className="text-muted-foreground">Set not found.</p>
      </TutorPageContainer>
    )
  }

  if (dialogOpen) {
    return (
      <UcatSkillTrainerSetDialog
        open={dialogOpen}
        setId={setId}
        onClose={() => {
          setDialogOpen(false)
          router.push('/ucat/skill-trainer-sets')
        }}
        onDeleted={() => router.push('/ucat/skill-trainer-sets')}
      />
    )
  }

  return (
    <TutorPageContainer className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{editor.name || 'Skill trainer set'}</h1>
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
        <UcatSkillTrainerSetEditorShell editor={editor} />
      </div>
    </TutorPageContainer>
  )
}
