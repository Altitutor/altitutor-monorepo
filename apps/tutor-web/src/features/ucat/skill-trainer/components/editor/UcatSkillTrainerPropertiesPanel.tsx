'use client'

import type { UseFormReturn } from 'react-hook-form'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  Label,
  Switch,
} from '@altitutor/ui'
import { Eye, EyeOff } from 'lucide-react'
import { SegmentedControl } from '@/shared/components/segmented-control'
import type { UcatSkillTrainerApprovalStatus } from '@altitutor/shared'
import type { UcatSkillTrainerItemFormValues } from '@/features/ucat/skill-trainer/types/schema'
import { tutorCardCn } from '@/shared/lib/tutor-visual'

export type SkillTrainerEditorMode = 'edit' | 'view'

type TrainerOption = { id: string; key: string; name: string }

type Props = {
  form: UseFormReturn<UcatSkillTrainerItemFormValues>
  trainers: TrainerOption[]
  editorMode: SkillTrainerEditorMode
  onEditorModeChange: (mode: SkillTrainerEditorMode) => void
  showAnswer: boolean
  onShowAnswerChange: (show: boolean) => void
  approvalStatus?: UcatSkillTrainerApprovalStatus
  onApprovalChange?: (status: UcatSkillTrainerApprovalStatus) => void
  isNew?: boolean
}

function PropertiesCard({ value, title, children }: { value: string; title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={value} className="border-0">
      <div className={tutorCardCn('overflow-hidden')}>
        <AccordionTrigger className="px-3 py-2.5 hover:no-underline [&>svg]:text-muted-foreground">
          <span className="text-sm font-semibold">{title}</span>
        </AccordionTrigger>
        <AccordionContent className="space-y-3 border-t border-black/[0.06] px-3 pb-4 pt-2 dark:border-white/10">
          {children}
        </AccordionContent>
      </div>
    </AccordionItem>
  )
}

export function UcatSkillTrainerPropertiesPanel({
  form,
  trainers,
  editorMode,
  onEditorModeChange,
  showAnswer,
  onShowAnswerChange,
  approvalStatus,
  onApprovalChange,
  isNew,
}: Props) {
  const trainerKey = form.watch('trainerKey')
  const trainerName = trainers.find((t) => t.key === trainerKey)?.name ?? trainerKey

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l bg-muted/20">
      <div className="space-y-3 p-3">
        <Accordion type="multiple" defaultValue={['display', 'item']} className="space-y-2">
          <PropertiesCard value="display" title="Display">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Mode</Label>
                <SegmentedControl
                  fullWidth
                  value={editorMode}
                  onValueChange={onEditorModeChange}
                  options={[
                    { value: 'edit', label: 'Edit' },
                    { value: 'view', label: 'Preview' },
                  ]}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-sm">Show answer</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onShowAnswerChange(!showAnswer)}
                >
                  {showAnswer ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </PropertiesCard>

          <PropertiesCard value="item" title="Item">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Trainer type</Label>
                <p className="text-sm font-medium">{trainerName}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="is-active" className="text-sm">
                  Active in bank
                </Label>
                <Switch
                  id="is-active"
                  checked={form.watch('isActive')}
                  onCheckedChange={(checked) => form.setValue('isActive', checked, { shouldDirty: true })}
                />
              </div>
              {!isNew && approvalStatus && onApprovalChange ? (
                <div className="space-y-2 border-t pt-3">
                  <Label className="text-xs text-muted-foreground">Approval</Label>
                  <p className="text-sm capitalize">{approvalStatus}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => onApprovalChange('approved')}>
                      Approve
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onApprovalChange('pending')}>
                      Pending
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => onApprovalChange('rejected')}>
                      Reject
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </PropertiesCard>
        </Accordion>
      </div>
    </aside>
  )
}
