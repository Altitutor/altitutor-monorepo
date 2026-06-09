'use client'

import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import type { UcatLearningModuleKind } from '@/features/ucat/learning-modules/types'

type UcatCreateLearningModuleDialogProps = {
  open: boolean
  kind: UcatLearningModuleKind
  title: string
  isSaving: boolean
  onClose: () => void
  onSave: () => void
  onKindChange: (kind: UcatLearningModuleKind) => void
  onTitleChange: (title: string) => void
}

export function UcatCreateLearningModuleDialog({
  open,
  kind,
  title,
  isSaving,
  onClose,
  onSave,
  onKindChange,
  onTitleChange,
}: UcatCreateLearningModuleDialogProps) {
  return (
    <UcatDialogShell
      open={open}
      onClose={onClose}
      title="New learning module"
      subtitle="Choose folder or lesson. Configure blocks and settings after creation."
      onSave={onSave}
      saveDisabled={!title.trim()}
      isSaving={isSaving}
    >
      <div className="overflow-y-auto px-6 py-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => onKindChange(v as UcatLearningModuleKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="folder">Folder</SelectItem>
                <SelectItem value="lesson">Lesson</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Module title"
            />
          </div>
        </div>
      </div>
    </UcatDialogShell>
  )
}
