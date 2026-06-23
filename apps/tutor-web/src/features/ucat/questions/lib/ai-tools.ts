import { z } from 'zod'
import type { Json } from '@altitutor/shared'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  hasRichTextContent,
  plainTextToProseMirror,
  plainTextToProseMirrorWithLineBreaks,
  proseMirrorHasBlockTable,
  proseMirrorToPlainText,
} from '@/features/ucat/shared/lib/rich-text'

export const AiToolQuestionStemPayloadSchema = z.object({
  sectionId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  stemText: z.unknown(),
  isPrivate: z.boolean().default(true),
  questions: z.array(
    z.object({
      questionText: z.unknown(),
      questionType: z.enum(['multiple_choice', 'syllogism']),
      answerExplanation: z.unknown().nullable().optional(),
      difficulty: z.number().nullable().optional(),
      timeBurdenSeconds: z.string().nullable().optional(),
      tagIds: z.array(z.string().uuid()).default([]),
      options: z.array(
        z.object({
          answerText: z.unknown(),
          answerExplanation: z.unknown().nullable().optional(),
          isAnswer: z.boolean(),
        })
      ),
    })
  ).min(1),
})

export const AiToolRewriteResponseSchema = z.object({
  stemText: z.string().min(1),
  questions: z.array(
    z.object({
      questionText: z.string().min(1),
      options: z.array(z.string().min(1)).min(1),
    })
  ).min(1),
  summary: z.string().nullable().optional(),
})

export const AiToolExplanationUpdateSchema = z.object({
  questionIndex: z.number().int().nonnegative(),
  answerExplanation: z.string().nullable().optional(),
  optionExplanations: z.array(z.string().nullable()).optional(),
  confidence: z.number().min(0).max(1).default(0.5),
  unresolved: z.boolean().default(false),
  rationale: z.string().nullable().optional(),
  reviewRequired: z.boolean().default(false),
  reviewMessage: z.string().nullable().optional(),
  suggestedCorrectOptionIndex: z.number().int().nonnegative().nullable().optional(),
  suggestedChanges: z.string().nullable().optional(),
})

export const AiToolExplanationResponseSchema = z.object({
  updates: z.array(AiToolExplanationUpdateSchema).default([]),
})

export type AiToolQuestionStemPayload = z.infer<typeof AiToolQuestionStemPayloadSchema>
export type AiToolExplanationUpdate = z.infer<typeof AiToolExplanationUpdateSchema>

export type AiToolReviewFlag = {
  questionIndex: number
  message: string
  suggestedCorrectOptionIndex?: number | null
  suggestedChanges?: string | null
}

export type MissingExplanationTarget = {
  stemIndex?: number
  questionIndex: number
  questionNumber: number
  kind: 'question' | 'option'
  optionIndex?: number
}

function asJson(value: unknown): Json | null {
  return value == null ? null : (value as Json)
}

function containsUnsupportedRewriteNode(value: Json | null | undefined): boolean {
  if (proseMirrorHasBlockTable(value)) return true
  if (!value || typeof value !== 'object') return false
  const visit = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    const rec = node as Record<string, unknown>
    if (rec.type === 'image') return true
    const content = rec.content
    return Array.isArray(content) ? content.some(visit) : false
  }
  return visit(value)
}

export function assertRewriteSupported(stem: AiToolQuestionStemPayload) {
  const richTexts = [
    asJson(stem.stemText),
    ...stem.questions.flatMap((question) => [
      asJson(question.questionText),
      ...question.options.map((option) => asJson(option.answerText)),
    ]),
  ]
  if (richTexts.some((value) => containsUnsupportedRewriteNode(value))) {
    throw new Error('Rewrite is only available for text-only stems. Stems with images or tables must be edited manually.')
  }
}

export function summarizeStemForAi(stem: AiToolQuestionStemPayload) {
  return {
    stemText: proseMirrorToPlainText(asJson(stem.stemText)) ?? '',
    questions: stem.questions.map((question, questionIndex) => ({
      questionIndex,
      questionText: proseMirrorToPlainText(asJson(question.questionText)) ?? '',
      questionType: question.questionType,
      answerExplanation: proseMirrorToPlainText(asJson(question.answerExplanation)) ?? '',
      selectedCorrectOptions: question.options
        .map((option, optionIndex) => ({
          optionIndex,
          label: String.fromCharCode(65 + optionIndex),
          answerText: proseMirrorToPlainText(asJson(option.answerText)) ?? '',
          isAnswer: option.isAnswer,
        }))
        .filter((option) => option.isAnswer),
      options: question.options.map((option, optionIndex) => ({
        optionIndex,
        label: String.fromCharCode(65 + optionIndex),
        answerText: proseMirrorToPlainText(asJson(option.answerText)) ?? '',
        isAnswer: option.isAnswer,
        answerExplanation: proseMirrorToPlainText(asJson(option.answerExplanation)) ?? '',
      })),
    })),
  }
}

export function rewriteResponseToStemValues(
  original: UcatQuestionStemFormValues,
  rewrite: z.infer<typeof AiToolRewriteResponseSchema>
): UcatQuestionStemFormValues {
  return {
    ...original,
    stemText: plainTextToProseMirrorWithLineBreaks(rewrite.stemText),
    questions: original.questions.map((question, questionIndex) => {
      const rewrittenQuestion = rewrite.questions[questionIndex]
      if (!rewrittenQuestion) return question
      return {
        ...question,
        questionText: plainTextToProseMirrorWithLineBreaks(rewrittenQuestion.questionText),
        options: question.options.map((option, optionIndex) => ({
          ...option,
          answerText:
            typeof rewrittenQuestion.options[optionIndex] === 'string'
              ? plainTextToProseMirror(rewrittenQuestion.options[optionIndex]!)
              : option.answerText,
        })),
      }
    }),
  }
}

export function findMissingExplanations(
  stem: Pick<UcatQuestionStemFormValues, 'questions'>,
  stemIndex?: number
): MissingExplanationTarget[] {
  const targets: MissingExplanationTarget[] = []
  stem.questions.forEach((question, questionIndex) => {
    if (question.questionType === 'syllogism') {
      question.options.forEach((option, optionIndex) => {
        if (!hasRichTextContent(option.answerExplanation ?? null)) {
          targets.push({
            stemIndex,
            questionIndex,
            questionNumber: questionIndex + 1,
            kind: 'option',
            optionIndex,
          })
        }
      })
      return
    }
    if (!hasRichTextContent(question.answerExplanation ?? null)) {
      targets.push({ stemIndex, questionIndex, questionNumber: questionIndex + 1, kind: 'question' })
    }
  })
  return targets
}

export function applyExplanationUpdates(
  stem: UcatQuestionStemFormValues,
  updates: AiToolExplanationUpdate[]
): { stem: UcatQuestionStemFormValues; appliedCount: number } {
  let appliedCount = 0
  const next: UcatQuestionStemFormValues = {
    ...stem,
    questions: stem.questions.map((question, questionIndex) => {
      const update = updates.find(
        (item) => item.questionIndex === questionIndex && !item.unresolved && !item.reviewRequired
      )
      if (!update) return question
      if (question.questionType === 'syllogism') {
        return {
          ...question,
          options: question.options.map((option, optionIndex) => {
            if (hasRichTextContent(option.answerExplanation ?? null)) return option
            const explanation = update.optionExplanations?.[optionIndex]?.trim()
            if (!explanation) return option
            appliedCount += 1
            return { ...option, answerExplanation: plainTextToProseMirror(explanation) }
          }),
        }
      }
      if (hasRichTextContent(question.answerExplanation ?? null)) return question
      const explanation = update.answerExplanation?.trim()
      if (!explanation) return question
      appliedCount += 1
      return { ...question, answerExplanation: plainTextToProseMirror(explanation) }
    }),
  }
  return { stem: next, appliedCount }
}

export function collectExplanationReviewFlags(updates: AiToolExplanationUpdate[]): AiToolReviewFlag[] {
  return updates
    .filter((update) => update.reviewRequired)
    .map((update) => ({
      questionIndex: update.questionIndex,
      message:
        update.reviewMessage?.trim() ||
        update.rationale?.trim() ||
        'The selected answer or question may need tutor review.',
      suggestedCorrectOptionIndex: update.suggestedCorrectOptionIndex ?? null,
      suggestedChanges: update.suggestedChanges ?? null,
    }))
}
