import type { Json } from '@altitutor/shared'
import type { StemDetailRow } from '@/features/ucat/questions/api/questions'
import { snapshotQuestionStemFormValues } from '@/features/ucat/shared/lib/dirty-state'
import { DEFAULT_OPTIONS, EMPTY_DOC } from '@/features/ucat/questions/constants/stemFormConstants'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { UcatContentStatus, UcatQuestionStemBundlePayload } from '@/features/ucat/shared/types'
import { filterOptionsWithContent } from '@/features/ucat/shared/lib/rich-text'
import { parseTimeToSeconds, secondsToTimeString } from '@/features/ucat/shared/lib/time-utils'

export function buildEmptyStemFormValues(sectionId = ''): UcatQuestionStemFormValues {
  return {
    sectionId,
    categoryId: null,
    stemText: EMPTY_DOC,
    accessScope: 'public',
    questions: [
      {
        questionText: EMPTY_DOC,
        questionType: 'multiple_choice',
        answerExplanation: null,
        difficulty: null,
        timeBurdenSeconds: '',
        tagIds: [],
        sourceChannel: 'individual',
        aiGenerationMetadata: null,
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
    accessScope: initial.access_scope,
    tutorSourceNote: initial.tutor_source_note ?? '',
    status: (initial.status ?? 'published') as UcatContentStatus,
    questions: (initial.questions ?? []).map((question) => ({
      id: question.id,
      questionText: (question.question_text ?? EMPTY_DOC) as Json,
      answerExplanation: (question.answer_explanation ?? null) as Json | null,
      questionType: question.question_type,
      difficulty: question.difficulty,
      timeBurdenSeconds: question.time_burden_seconds != null ? secondsToTimeString(question.time_burden_seconds) : '',
      tagIds: (question.tags ?? []).map((tag) => tag.id),
      sourceChannel: question.source_channel ?? initial.source_channel ?? null,
      aiGenerationMetadata: question.ai_generation_metadata ?? null,
      options:
        (question.answer_options ?? []).length > 0
          ? (question.answer_options ?? []).map((option) => ({
              id: option.id,
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
    accessScope: payload.accessScope,
    sourceChannel: stemId ? undefined : 'individual',
    tutorSourceNote: payload.tutorSourceNote ?? null,
    questions: payload.questions.map((question, index) => ({
      index: index + 1,
      id: question.id,
      questionText: question.questionText,
      questionType: question.questionType,
      answerExplanation: toExplanationNull(question.answerExplanation),
      difficulty: question.difficulty,
      timeBurdenSeconds: parseTimeToSeconds(question.timeBurdenSeconds ?? '') ?? null,
      sourceChannel: question.sourceChannel ?? (stemId ? undefined : 'individual'),
      aiGenerationMetadata: question.aiGenerationMetadata ?? null,
      tagIds: question.tagIds ?? [],
      options: filterOptionsWithContent(question.options).map((option, optionIndex) => ({
        id: option.id,
        index: optionIndex + 1,
        answerText: option.answerText,
        answerExplanation: toExplanationNull(option.answerExplanation),
        isAnswer: option.isAnswer,
      })),
    })),
  }
}

export function parseContentStatusFromSnapshot(snapshot: string): UcatContentStatus | null {
  if (!snapshot) return null
  try {
    const parsed = JSON.parse(snapshot) as { status?: UcatContentStatus | null }
    return parsed.status ?? null
  } catch {
    return null
  }
}

function stemContentChanged(nextSnapshot: string, baselineSnapshot: string): boolean {
  if (!baselineSnapshot) return true
  try {
    const next = JSON.parse(nextSnapshot) as Record<string, unknown>
    const baseline = JSON.parse(baselineSnapshot) as Record<string, unknown>
    delete next.status
    delete baseline.status
    return JSON.stringify(next) !== JSON.stringify(baseline)
  } catch {
    return true
  }
}

export async function persistStemFormValues(
  stemId: string,
  values: UcatQuestionStemFormValues,
  options: {
    baselineSnapshot: string
    updateStem: (payload: UcatQuestionStemBundlePayload) => Promise<unknown>
    setStatus?: (status: UcatContentStatus) => Promise<unknown>
  },
): Promise<string> {
  const valuesCopy = JSON.parse(JSON.stringify(values)) as UcatQuestionStemFormValues
  const nextSnapshot = snapshotQuestionStemFormValues(valuesCopy)
  if (stemContentChanged(nextSnapshot, options.baselineSnapshot)) {
    await options.updateStem(formValuesToStemBundlePayload(valuesCopy, stemId))
  }

  const previousStatus = parseContentStatusFromSnapshot(options.baselineSnapshot)
  const nextStatus = valuesCopy.status ?? null
  if (options.setStatus && nextStatus && nextStatus !== previousStatus) {
    await options.setStatus(nextStatus)
  }

  return nextSnapshot
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
