'use client'

import React, { useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button, useToast } from '@altitutor/ui'
import { useRouter } from 'next/navigation'
import { CheckCircle2, FilePenLine, ListChecks, Send } from 'lucide-react'
import { ucatQuestionStemSchema, type UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { ucatQuestionsApi, type StemDetailRow } from '@/features/ucat/questions/api/questions'
import type { UcatContentStatus } from '@/features/ucat/shared/types'
import { buildEmptyStemFormValues, persistStemFormValues, stemDetailToFormValues } from '@/features/ucat/questions/lib/stem-editor-form'
import {
  useUcatCategories,
  useUcatQuestionDetail,
  useUcatSections,
  useSetUcatQuestionStemStatus,
  useUcatTags,
  useUpdateUcatQuestionStem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { UcatPageHeader, UcatPageSkeleton, UcatAccessDenied } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { isSnapshotDirty, snapshotQuestionStemFormValues } from '@/features/ucat/shared/lib/dirty-state'
import {
  type CategoryOption,
  type TagOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { UcatStemEditorShell } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorShell'
import { UcatRichTextFloatingToolbar } from '@/features/ucat/shared/components/UcatRichTextFloatingToolbar'
import { UcatSetEditorDialog } from '@/features/ucat/sets/components/UcatSetEditorDialog'
import { mapCategoriesToOptions, mapTagsToOptions } from '@/features/ucat/shared/lib/taxonomy-paths'
import { lifecycleErrorToast, lifecycleStatusSuccessToast, type UcatLifecycleEntityType } from '@/features/ucat/shared/lifecycle-errors'

type UcatQuestionStemDetailPageProps = {
  stemId: string
}

export function UcatQuestionStemDetailPage({ stemId }: UcatQuestionStemDetailPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const access = useUcatAccess()
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const detailQuery = useUcatQuestionDetail(stemId)
  const updateStemMutation = useUpdateUcatQuestionStem()
  const statusMutation = useSetUcatQuestionStemStatus()

  const isLoading =
    access.isLoading ||
    sectionsQuery.isLoading ||
    categoriesQuery.isLoading ||
    tagsQuery.isLoading ||
    detailQuery.isLoading

  const sections = useMemo(() => sectionsQuery.data ?? [], [sectionsQuery.data])
  const categories = categoriesQuery.data ?? []
  const tags = tagsQuery.data ?? []

  const initial = detailQuery.data as StemDetailRow | null

  const defaultValues = useMemo<UcatQuestionStemFormValues>(() => {
    const fallbackSectionId = sections.find((section) => section.id)?.id ?? ''
    if (!initial) return buildEmptyStemFormValues(fallbackSectionId)
    return stemDetailToFormValues(initial, fallbackSectionId)
  }, [initial, sections])

  const createForm = useForm as unknown as (props: {
    resolver: unknown
    defaultValues: UcatQuestionStemFormValues
  }) => UseFormReturn<UcatQuestionStemFormValues>

  const form = createForm({
    resolver: zodResolver(ucatQuestionStemSchema),
    defaultValues,
  })

  const baseline = useMemo(() => snapshotQuestionStemFormValues(defaultValues), [defaultValues])
  const watchedValues = form.watch()
  const hasUnsavedChanges = isSnapshotDirty(snapshotQuestionStemFormValues(watchedValues), baseline)
  const status = (watchedValues.status ?? initial?.status ?? 'published') as UcatContentStatus

  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)
  const [editingSetId, setEditingSetId] = useState<string | null>(null)

  function openLifecycleEntity(entityType: UcatLifecycleEntityType, entityId: string) {
    if (entityType === 'set') {
      setEditingSetId(entityId)
      return true
    }
    return false
  }

  async function onSubmit(values: UcatQuestionStemFormValues) {
    if (!stemId) return
    await persistStemFormValues(stemId, values, {
      baselineSnapshot: baseline,
      updateStem: (payload) => updateStemMutation.mutateAsync({ stemId, payload }),
      setStatus: (status) => statusMutation.mutateAsync({ stemId, status }),
    })
  }

  async function handleSetStatus(status: UcatContentStatus) {
    const previousStatus = (form.getValues('status') ?? initial?.status ?? 'draft') as UcatContentStatus
    form.setValue('status', status, { shouldDirty: true })
    try {
      await onSubmit({ ...form.getValues(), status })
      toast(lifecycleStatusSuccessToast({
        contentLabel: 'Question',
        count: 1,
        status,
        onUndo: () => {
          void ucatQuestionsApi.bulkRestoreStatus([stemId], status, previousStatus)
            .then(() => {
              form.setValue('status', previousStatus, { shouldDirty: false })
              toast({ title: 'Question status restored' })
            })
            .catch((error) => toast(lifecycleErrorToast(error, 'Could not undo status change', router.push, openLifecycleEntity)))
        },
      }))
    } catch (error) {
      form.setValue('status', previousStatus, { shouldDirty: true })
      toast(lifecycleErrorToast(error, 'Cannot change question status', router.push, openLifecycleEntity))
    }
  }

  if (isLoading) return <UcatPageSkeleton rows={6} />
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title="Edit UCAT Question Stem"
        description={initial?.id ? `Editing stem ${initial.id}` : 'Edit question stem'}
        backHref={status === 'draft' ? '/ucat/questions' : `/ucat/questions?tab=${status}`}
        breadcrumbs={[
          { label: 'UCAT', href: '/ucat' },
          { label: 'Questions', href: '/ucat/questions' },
          { label: stemId ?? 'Question stem' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {status !== 'draft' ? (
                <Button
                  variant="outline"
                  onClick={() => void handleSetStatus('draft')}
                  disabled={statusMutation.isPending}
                >
                  <FilePenLine className="mr-2 h-4 w-4" />
                  Move to draft
                </Button>
            ) : null}
            {status === 'published' ? (
              <Button
                  variant="outline"
                  onClick={() => void handleSetStatus('in_review')}
                  disabled={statusMutation.isPending}
                >
                  <ListChecks className="mr-2 h-4 w-4" />
                  Move to review
                </Button>
            ) : null}
            {status === 'draft' ? (
              <Button
                variant="outline"
                onClick={() => void handleSetStatus('in_review')}
                disabled={statusMutation.isPending}
              >
                <Send className="mr-2 h-4 w-4" />
                Send for review
              </Button>
            ) : null}
            {status === 'in_review' ? (
                <Button
                  onClick={() => void handleSetStatus('published')}
                  disabled={statusMutation.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Publish
                </Button>
            ) : null}
            <Button
              onClick={form.handleSubmit(onSubmit)}
              disabled={!hasUnsavedChanges || updateStemMutation.isPending}
            >
              {updateStemMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        }
      />

      <div className="relative mt-4 flex min-h-[min(72vh,900px)] overflow-hidden rounded-lg border bg-card shadow-sm">
        <UcatStemEditorShell
          form={form}
          sections={sections.map((section) => ({
            id: section.id,
            name: section.name,
            display_columns: section.display_columns,
          }))}
          categories={mapCategoriesToOptions(categories) as CategoryOption[]}
          tags={mapTagsToOptions(tags) as TagOption[]}
          stemId={stemId}
          initialEditorMode={initial?.status === 'published' ? 'view' : 'edit'}
          enableImages
          sectionTitleOverride={initial?.section_name ?? undefined}
          displayColumnsFallback={initial?.display_columns ?? undefined}
          className="flex min-h-0 flex-1 overflow-hidden"
          onActiveTextEditorChange={setActiveTextEditor}
          sourceChannel={initial?.source_channel ?? null}
          aiGenerationMetadata={initial?.ai_generation_metadata ?? null}
          createdByFirstName={initial?.created_by_first_name ?? null}
          createdByLastName={initial?.created_by_last_name ?? null}
          statusChangedByFirstName={initial?.status_changed_by_first_name ?? null}
          statusChangedByLastName={initial?.status_changed_by_last_name ?? null}
          statusChangedAt={initial?.status_changed_at ?? null}
          aiReviewAvailable={status !== 'draft'}
        />
        <UcatRichTextFloatingToolbar editor={activeTextEditor} />
      </div>
      <UcatSetEditorDialog
        open={!!editingSetId}
        setId={editingSetId}
        onClose={() => setEditingSetId(null)}
      />
    </div>
  )
}
