import type { Json } from '@altitutor/shared'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
import { DEFAULT_OPTIONS, EMPTY_DOC } from '@/features/ucat/questions/constants/stemFormConstants'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import { filterOptionsWithContent } from '@/features/ucat/shared/lib/rich-text'
import { parseTimeToSeconds, secondsToTimeString } from '@/features/ucat/shared/lib/time-utils'

export function buildEmptyStemFormValues(sectionId = ''): UcatQuestionStemFormValues {
  return {
    sectionId,
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

export function stemDetailToFormValues(
  initial: StemDetailRow | null | undefined,
  fallbackSectionId = '',
): UcatQuestionStemFormValues {
  if (!initial) return buildEmptyStemFormValues(fallbackSectionId)

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
}

function toExplanationNull(value: unknown): Json | null {
  if (value == null) return null
  if (typeof value === 'string' && value === 'null') return null
  return value as Json
}

export function formValuesToStemBundlePayload(
  payload: UcatQuestionStemFormValues,
  stemId?: string | null,
): UcatQuestionStemBundlePayload {
  return {
    stemId: stemId ?? undefined,
    sectionId: payload.sectionId,
    categoryId: payload.categoryId || null,
    stemText: payload.stemText,
    isPrivate: payload.isPrivate,
    questions: payload.questions.map((question, index) => ({
      index: index + 1,
      questionText: question.questionText,
      questionType: question.questionType,
      answerExplanation: toExplanationNull(question.answerExplanation),
      difficulty: question.difficulty,
      timeBurdenSeconds: parseTimeToSeconds(question.timeBurdenSeconds ?? '') ?? null,
      tagIds: question.tagIds ?? [],
      options: filterOptionsWithContent(question.options).map((option, optionIndex) => ({
        index: optionIndex + 1,
        answerText: option.answerText,
        answerExplanation: toExplanationNull(option.answerExplanation),
        isAnswer: option.isAnswer,
      })),
    })),
  }
}

export function getFirstStemValidationMessage(errors: Record<string, unknown>): string {
  for (const key of Object.keys(errors)) {
    const value = errors[key]
    if (value && typeof value === 'object' && 'message' in value && typeof (value as { message: unknown }).message === 'string') {
      return (value as { message: string }).message
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = getFirstStemValidationMessage(value as Record<string, unknown>)
      if (nested) return nested
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') {
          const nested = getFirstStemValidationMessage(item as Record<string, unknown>)
          if (nested) return nested
        }
      }
    }
  }
  return 'Please fix the errors in the form.'
}
