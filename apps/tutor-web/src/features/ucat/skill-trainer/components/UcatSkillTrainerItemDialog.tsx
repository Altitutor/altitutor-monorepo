'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useToast } from '@altitutor/ui'
import type { UcatSkillTrainerApprovalStatus, UcatSkillTrainerKey } from '@altitutor/shared'
import { UcatDialogShell } from '@/features/ucat/shared/dialog-shell'
import { isSnapshotDirty } from '@/features/ucat/shared/lib/dirty-state'
import type { UcatSkillTrainerItemRow } from '@/features/ucat/skill-trainer/api/items'
import { UcatSkillTrainerEditorShell } from '@/features/ucat/skill-trainer/components/editor/UcatSkillTrainerEditorShell'
import {
  createEmptyFormValues,
  mapFormValuesToContent,
  mapRowToFormValues,
  snapshotSkillTrainerItemFormValues,
} from '@/features/ucat/skill-trainer/lib/form-mappers'
import {
  ucatSkillTrainerItemFormSchema,
  type UcatSkillTrainerItemFormValues,
} from '@/features/ucat/skill-trainer/types/schema'

type TrainerOption = { id: string | null; key: string | null; name: string | null }

function getFirstValidationMessage(errors: Record<string, unknown>): string {
  for (const key of Object.keys(errors)) {
    const value = errors[key]
    if (value && typeof value === 'object' && 'message' in value && typeof (value as { message: unknown }).message === 'string') {
      return (value as { message: string }).message
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = getFirstValidationMessage(value as Record<string, unknown>)
      if (nested) return nested
    }
  }
  return 'Please fix the errors in the form.'
}

type Props = {
  open: boolean
  title: string
  submitLabel: string
  onClose: () => void
  onSubmit: (values: {
    itemId?: string | null
    skillTrainerId: string
    content: Record<string, unknown>
    isActive: boolean
  }) => Promise<string>
  onApprovalChange?: (status: UcatSkillTrainerApprovalStatus) => Promise<void>
  trainers: TrainerOption[]
  trainerKey: UcatSkillTrainerKey
  initial?: UcatSkillTrainerItemRow | null
  loading?: boolean
}

export function UcatSkillTrainerItemDialog({
  open,
  title,
  submitLabel,
  onClose,
  onSubmit,
  onApprovalChange,
  trainers,
  trainerKey,
  initial,
  loading,
}: Props) {
  const { toast } = useToast()
  const trainerOptions = useMemo(
    () =>
      trainers
        .filter((t): t is { id: string; key: string; name: string } => Boolean(t.id && t.key && t.name))
        .map((t) => ({ id: t.id, key: t.key, name: t.name })),
    [trainers]
  )

  const defaultValues = useMemo<UcatSkillTrainerItemFormValues>(() => {
    if (initial) return mapRowToFormValues(initial)
    const trainer = trainerOptions.find((t) => t.key === trainerKey) ?? trainerOptions[0]
    if (!trainer) {
      return createEmptyFormValues('', trainerKey)
    }
    return createEmptyFormValues(trainer.id, trainer.key as UcatSkillTrainerKey)
  }, [initial, trainerKey, trainerOptions])

  const createForm = useForm as unknown as (props: {
    resolver: unknown
    defaultValues: UcatSkillTrainerItemFormValues
  }) => UseFormReturn<UcatSkillTrainerItemFormValues>

  const form = createForm({
    resolver: zodResolver(ucatSkillTrainerItemFormSchema),
    defaultValues,
  })

  const [baseline, setBaseline] = useState('')
  const lastResetItemIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (initial) {
      if (lastResetItemIdRef.current !== initial.id) {
        lastResetItemIdRef.current = initial.id
        form.reset(defaultValues)
        setBaseline(snapshotSkillTrainerItemFormValues(defaultValues))
      }
    } else {
      lastResetItemIdRef.current = null
    }
  }, [initial, defaultValues, form])

  useEffect(() => {
    if (!open) lastResetItemIdRef.current = null
  }, [open])

  useEffect(() => {
    if (open && !initial) {
      const trainer = trainerOptions.find((t) => t.key === trainerKey) ?? trainerOptions[0]
      if (!trainer) return
      const empty = createEmptyFormValues(trainer.id, trainer.key as UcatSkillTrainerKey)
      form.reset(empty)
      setBaseline(snapshotSkillTrainerItemFormValues(empty))
    }
  }, [open, initial, trainerKey, trainerOptions, form])

  const watchedValues = form.watch()
  const hasUnsavedChanges =
    baseline !== '' && isSnapshotDirty(snapshotSkillTrainerItemFormValues(watchedValues), baseline)

  async function handleSave() {
    // @ts-expect-error TS2589 - Form type is deep; runtime behavior is correct.
    form.handleSubmit(
      async (values) => {
        try {
          const valuesCopy = JSON.parse(JSON.stringify(values)) as UcatSkillTrainerItemFormValues
          await onSubmit({
            itemId: initial?.id ?? null,
            skillTrainerId: valuesCopy.skillTrainerId,
            content: mapFormValuesToContent(valuesCopy),
            isActive: valuesCopy.isActive,
          })
          setBaseline(snapshotSkillTrainerItemFormValues(valuesCopy))
        } catch (error) {
          toast({
            title: 'Failed to save',
            description: error instanceof Error ? error.message : 'Failed to save item',
            variant: 'destructive',
          })
        }
      },
      (errs: Record<string, unknown>) => {
        toast({
          title: 'Validation failed',
          description: getFirstValidationMessage(errs),
          variant: 'destructive',
        })
      }
    )()
  }

  function handleRequestClose() {
    if (!hasUnsavedChanges || window.confirm('Changes made will be lost. Close without saving?')) {
      onClose()
    }
  }

  return (
    <UcatDialogShell
      open={open}
      onClose={handleRequestClose}
      title={title}
      subtitle="Author skill trainer drill content"
      onSave={handleSave}
      saveLabel={submitLabel}
      saveDisabled={loading}
      isSaving={loading}
      hideCancel
      defaultExpanded
    >
      <UcatSkillTrainerEditorShell
        form={form}
        trainers={trainerOptions}
        approvalStatus={initial?.approval_status}
        onApprovalChange={
          onApprovalChange && initial
            ? (status) => {
                void onApprovalChange(status)
              }
            : undefined
        }
        isNew={!initial}
        previewContentKey={initial?.id ?? `new-${trainerKey}`}
      />
    </UcatDialogShell>
  )
}
