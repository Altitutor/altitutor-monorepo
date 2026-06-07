'use client'

import React, { useMemo } from 'react'
import type { Json } from '@altitutor/shared'
import type { UseFormReturn } from 'react-hook-form'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@altitutor/ui'
import { ucatQuestionStemSchema, type UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
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
import { parseTimeToSeconds, secondsToTimeString } from '@/features/ucat/shared/lib/time-utils'
import {
  DEFAULT_OPTIONS,
  EMPTY_DOC,
  type CategoryOption,
  type TagOption,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'
import { UcatStemEditorShell } from '@/features/ucat/questions/components/stem-editor/UcatStemEditorShell'

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
    if (!initial) {
      return {
        sectionId: sections.find((section) => section.id)?.id ?? '',
        categoryId: null,
        stemText: EMPTY_DOC,
        isPrivate: false,
        questions: [
          {
            questionText: EMPTY_DOC,
            questionType: 'multiple_choice',
            answerExplanation: null,
            difficulty: null,
            timeBurdenSeconds: '',
            tagIds: [],
            options: [...DEFAULT_OPTIONS],
          },
        ],
      }
    }

    return {
      sectionId: initial.section_id,
      categoryId: initial.question_stem_category_id,
      stemText: (initial.stem_text ?? EMPTY_DOC) as Json,
      isPrivate: initial.is_private,
      questions: (initial.questions ?? []).map((question) => ({
        questionText: (question.question_text ?? EMPTY_DOC) as Json,
        answerExplanation: (question.answer_explanation ?? null) as Json | null,
        questionType: question.question_type,
        difficulty: question.difficulty,
        timeBurdenSeconds: question.time_burden_seconds != null ? secondsToTimeString(question.time_burden_seconds) : '',
        tagIds: (question.tags ?? []).map((tag) => tag.id),
        options:
          (question.answer_options ?? []).length > 0
            ? (question.answer_options ?? []).map((option) => ({
                answerText: (option.answer_text ?? EMPTY_DOC) as Json,
                answerExplanation: (option.answer_explanation ?? null) as Json | null,
                isAnswer: option.is_answer,
              }))
            : [...DEFAULT_OPTIONS],
      })),
    }
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
  const hasUnsavedChanges = isSnapshotDirty(
    snapshotQuestionStemFormValues(watchedValues),
    baseline
  )

  async function onSubmit(values: UcatQuestionStemFormValues) {
    if (!stemId) return
    await updateStemMutation.mutateAsync({
      stemId,
      payload: {
        stemId,
        sectionId: values.sectionId,
        categoryId: values.categoryId ?? null,
        stemText: values.stemText,
        isPrivate: values.isPrivate,
        questions: values.questions.map((question, index) => ({
          index: index + 1,
          questionText: question.questionText,
          questionType: question.questionType,
          difficulty: question.difficulty,
          timeBurdenSeconds: parseTimeToSeconds(question.timeBurdenSeconds ?? '') ?? null,
          tagIds: question.tagIds ?? [],
          options: question.options.map((option, optionIndex) => ({
            index: optionIndex + 1,
            answerText: option.answerText,
            answerExplanation: option.answerExplanation,
            isAnswer: option.isAnswer,
          })),
        })),
      },
    })
  }

  const approvalStatus = (initial?.approval_status ?? 'approved') as
    | 'approved'
    | 'pending'
    | 'rejected'

  async function handleSetApproval(status: 'approved' | 'pending' | 'rejected') {
    await approvalMutation.mutateAsync({ stemId, status })
  }

  if (isLoading) return <UcatPageSkeleton rows={6} />
  if (!access.data) return <UcatAccessDenied />

  return (
    <div className="space-y-6 py-8 md:py-10">
      <UcatPageHeader
        title={mode === 'generated' ? 'Review generated UCAT stem' : 'Edit UCAT Question Stem'}
        description={initial?.id ? `Editing stem ${initial.id}` : 'Edit question stem'}
        backHref={mode === 'generated' ? '/ucat/questions/generated' : '/ucat/questions'}
        breadcrumbs={[
          { label: 'UCAT', href: '/ucat' },
          { label: 'Questions', href: '/ucat/questions' },
          ...(mode === 'generated' ? [{ label: 'Generated', href: '/ucat/questions/generated' }] : []),
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

      <div className="mt-4 flex min-h-[min(72vh,900px)] overflow-hidden rounded-lg border bg-card shadow-sm">
        <UcatStemEditorShell
          form={form}
          sections={sections.map((section) => ({
            id: section.id,
            name: section.name,
            display_columns: section.display_columns,
          }))}
          categories={
            categories.map((c) => ({
              id: c.id,
              name: c.name,
              ucat_section_id: c.ucat_section_id,
            })) as CategoryOption[]
          }
          tags={tags.map((t) => ({ id: t.id ?? '', name: t.name ?? '' })) as TagOption[]}
          stemId={stemId}
          enableImages
          sectionTitleOverride={initial?.section_name ?? undefined}
          displayColumnsFallback={initial?.display_columns ?? undefined}
          className="flex min-h-0 flex-1 overflow-hidden"
        />
      </div>
    </div>
  )
}

