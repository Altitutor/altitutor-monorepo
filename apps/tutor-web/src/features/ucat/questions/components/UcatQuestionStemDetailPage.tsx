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
  useUcatTags,
  useUpdateUcatQuestionStem,
} from '@/features/ucat/questions/hooks/useUcatQuestions'
import { UcatPageHeader, UcatPageSkeleton, UcatAccessDenied } from '@/features/ucat/shared/components'
import { useUcatAccess } from '@/features/ucat/shared/hooks/useUcatAccess'
import { parseTimeToSeconds, secondsToTimeString } from '@/features/ucat/shared/lib/time-utils'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import {
  DEFAULT_OPTIONS,
  EMPTY_DOC,
  type CategoryOption,
  type TagOption,
  UcatQuestionStemFormContent,
} from '@/features/ucat/questions/components/UcatQuestionStemDialog'

type UcatQuestionStemDetailPageProps = {
  stemId: string
}

export function UcatQuestionStemDetailPage({ stemId }: UcatQuestionStemDetailPageProps) {
  const access = useUcatAccess()
  const sectionsQuery = useUcatSections()
  const categoriesQuery = useUcatCategories()
  const tagsQuery = useUcatTags()
  const detailQuery = useUcatQuestionDetail(stemId)
  const updateStemMutation = useUpdateUcatQuestionStem()

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
                imageFileId: option.image_file_id ?? null,
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
            imageFileId: (option as { imageFileId?: string | null }).imageFileId ?? null,
          })),
        })),
      },
    })
  }

  if (isLoading) return <UcatPageSkeleton rows={6} />
  if (!access.data) return <UcatAccessDenied />

  const hasUnsavedChanges = form.formState.isDirty

  return (
    <div className="p-6">
      <UcatPageHeader
        title="Edit UCAT Question Stem"
        description={initial?.id ? `Editing stem ${initial.id}` : 'Edit question stem'}
        backHref="/ucat/questions"
        breadcrumbs={[
          { label: 'UCAT', href: '/ucat' },
          { label: 'Questions', href: '/ucat/questions' },
          { label: initial?.id ? proseMirrorToPlainText(initial.stem_text as Json) || 'Question stem' : 'Question stem' },
        ]}
        actions={
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={!hasUnsavedChanges || updateStemMutation.isPending}
          >
            {updateStemMutation.isPending ? 'Saving...' : 'Save changes'}
          </Button>
        }
      />

      <div className="mt-4 rounded-md border">
        <UcatQuestionStemFormContent
          form={form}
          sections={sections.map((section) => ({ id: section.id, name: section.name }))}
          categories={
            (categories.map((c) => ({
              id: c.id,
              name: c.name,
              ucat_section_id: c.ucat_section_id,
            })) as CategoryOption[])
          }
          tags={(tags.map((t) => ({ id: t.id ?? '', name: t.name ?? '' })) as TagOption[])}
          stemId={stemId}
          enableImages
        />
      </div>
    </div>
  )
}

