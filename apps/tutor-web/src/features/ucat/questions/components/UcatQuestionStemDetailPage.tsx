'use client'

import React, { useMemo, useState } from 'react'
import type { Editor } from '@tiptap/react'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@altitutor/ui'
import { ucatQuestionStemSchema, type UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { StemDetailRow, UcatApprovalStatus } from '@/features/ucat/questions/api/questions'
import { buildEmptyStemFormValues, persistStemFormValues, stemDetailToFormValues } from '@/features/ucat/questions/lib/stem-editor-form'
import {
  useUcatCategories,
  useUcatQuestionDetail,
  useUcatSections,
  useSetUcatQuestionStemApprovalStatus,
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
import { mapCategoriesToOptions, mapTagsToOptions } from '@/features/ucat/shared/lib/taxonomy-paths'

type UcatQuestionStemDetailPageProps = {
  stemId: string
  mode?: 'default' | 'generated'
}

export function UcatQuestionStemDetailPage({ stemId, mode = 'default' }: UcatQuestionStemDetailPageProps) {
  const access = useUcatAccess()
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const detailQuery = useUcatQuestionDetail(stemId)
  const updateStemMutation = useUpdateUcatQuestionStem()
  const approvalMutation = useSetUcatQuestionStemApprovalStatus()

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
  const approvalStatus = (watchedValues.approvalStatus ?? initial?.approval_status ?? 'approved') as UcatApprovalStatus

  const [activeTextEditor, setActiveTextEditor] = useState<Editor | null>(null)

  async function onSubmit(values: UcatQuestionStemFormValues) {
    if (!stemId) return
    await persistStemFormValues(stemId, values, {
      baselineSnapshot: baseline,
      updateStem: (payload) => updateStemMutation.mutateAsync({ stemId, payload }),
      setApprovalStatus: (status) => approvalMutation.mutateAsync({ stemId, status }),
    })
  }

  async function handleSetApproval(status: UcatApprovalStatus) {
    form.setValue('approvalStatus', status, { shouldDirty: true })
    await onSubmit({ ...form.getValues(), approvalStatus: status })
  }

  if (isLoading) return <UcatPageSkeleton rows={6} />
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title={mode === 'generated' ? 'Review generated UCAT stem' : 'Edit UCAT Question Stem'}
        description={initial?.id ? `Editing stem ${initial.id}` : 'Edit question stem'}
        backHref={mode === 'generated' ? '/ucat/questions?tab=generated' : '/ucat/questions'}
        breadcrumbs={[
          { label: 'UCAT', href: '/ucat' },
          { label: 'Questions', href: '/ucat/questions' },
          ...(mode === 'generated'
            ? [{ label: 'Generated questions', href: '/ucat/questions?tab=generated' }]
            : []),
          { label: stemId ?? 'Question stem' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {mode === 'generated' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => void handleSetApproval('rejected')}
                  disabled={approvalMutation.isPending || approvalStatus === 'rejected'}
                >
                  Reject
                </Button>
                <Button
                  variant="outline"
                  onClick={() => void handleSetApproval('pending')}
                  disabled={approvalMutation.isPending || approvalStatus === 'pending'}
                >
                  Mark pending
                </Button>
                <Button
                  onClick={() => void handleSetApproval('approved')}
                  disabled={approvalMutation.isPending || approvalStatus === 'approved'}
                >
                  Approve and publish
                </Button>
              </>
            )}
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
          enableImages
          sectionTitleOverride={initial?.section_name ?? undefined}
          displayColumnsFallback={initial?.display_columns ?? undefined}
          className="flex min-h-0 flex-1 overflow-hidden"
          onActiveTextEditorChange={setActiveTextEditor}
          sourceChannel={initial?.source_channel ?? null}
          aiGenerationMetadata={initial?.ai_generation_metadata ?? null}
          createdByFirstName={initial?.created_by_first_name ?? null}
          createdByLastName={initial?.created_by_last_name ?? null}
          approvedByFirstName={initial?.approved_by_first_name ?? null}
          approvedByLastName={initial?.approved_by_last_name ?? null}
          approvedAt={initial?.approved_at ?? null}
        />
        <UcatRichTextFloatingToolbar editor={activeTextEditor} />
      </div>
    </div>
  )
}
