'use client'

import type { ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
  SearchableSelect,
  Switch,
} from '@altitutor/ui'
import { Eye, EyeOff } from 'lucide-react'
import { SegmentedControl } from '@/shared/components/segmented-control'
import type { UcatSkillTrainerApprovalStatus } from '@altitutor/shared'
import type { UcatSkillTrainerItemFormValues } from '@/features/ucat/skill-trainer/types/schema'
import { tutorCardCn } from '@/shared/lib/tutor-visual'

const APPROVAL_OPTIONS: Array<{ value: UcatSkillTrainerApprovalStatus; label: string }> = [
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
]

function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="min-w-0 w-[58%]">{children}</div>
    </div>
  )
}

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

  const selectedApproval =
    approvalStatus != null ? (APPROVAL_OPTIONS.find((option) => option.value === approvalStatus) ?? null) : null

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col overflow-y-auto border-l bg-background p-4">
      <div className="space-y-4">
        <div className={tutorCardCn('space-y-4 p-3')}>
          <PropertyRow label="Mode">
            <SegmentedControl
              fullWidth
              value={editorMode}
              onValueChange={onEditorModeChange}
              options={[
                { value: 'edit', label: 'Edit' },
                { value: 'view', label: 'Preview' },
              ]}
            />
          </PropertyRow>
          {editorMode === 'view' ? (
            <PropertyRow label="Show answer">
              <Button
                type="button"
                variant={showAnswer ? 'secondary' : 'outline'}
                size="sm"
                className="w-full gap-1.5"
                onClick={() => onShowAnswerChange(!showAnswer)}
              >
                {showAnswer ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
            </PropertyRow>
          ) : null}
        </div>

        <Accordion type="multiple" defaultValue={['item']} className="space-y-2">
          <PropertiesCard value="item" title="Item">
            <PropertyRow label="Trainer type">
              <span className="block text-right text-sm text-foreground">{trainerName}</span>
            </PropertyRow>
            <PropertyRow label="Active in bank">
              <Switch
                id="is-active"
                checked={form.watch('isActive')}
                onCheckedChange={(checked) => form.setValue('isActive', checked, { shouldDirty: true })}
              />
            </PropertyRow>
            {!isNew && approvalStatus && onApprovalChange ? (
              <PropertyRow label="Approval">
                <SearchableSelect<{ value: UcatSkillTrainerApprovalStatus; label: string }>
                  items={APPROVAL_OPTIONS}
                  value={selectedApproval}
                  onValueChange={(item) => item && onApprovalChange(item.value)}
                  getItemLabel={(item) => item.label}
                  getItemId={(item) => item.value}
                  placeholder="Select approval status"
                />
              </PropertyRow>
            ) : null}
          </PropertiesCard>
        </Accordion>
      </div>
    </aside>
  )
}
