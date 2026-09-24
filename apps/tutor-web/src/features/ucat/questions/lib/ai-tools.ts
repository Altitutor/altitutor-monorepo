import { z } from 'zod'
import type { Json } from '@altitutor/shared'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  extractTextFromRichJson,
  hasRichTextContent,
  plainTextToProseMirror,
  plainTextToProseMirrorWithLineBreaks,
  proseMirrorHasBlockTable,
  proseMirrorToPlainText,
} from '@/features/ucat/shared/lib/rich-text'

const AiTimeBurdenInputSchema = z.string().nullable().optional().refine(
  (value) => {
    const input = value?.trim() ?? ''
    if (input === '') return true
    if (/^\d+$/u.test(input)) return Number(input) > 0
    if (!/^\d+:[0-5]\d$/u.test(input)) return false
    const [minutes = '0', seconds = '0'] = input.split(':')
    return (Number(minutes) * 60) + Number(seconds) > 0
  },
  'Expected time to correct must be positive whole seconds or mm:ss.',
).describe(
  'Expected active working time to a fully correct first-exposure answer, as positive whole seconds or mm:ss, with the question encountered in its authored stem position. Empty means unknown.',
)

export const AiToolQuestionStemPayloadSchema = z.object({
  sectionId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  stemText: z.unknown(),
  accessScope: z.enum(['public', 'private']).default('public'),
  questions: z.array(
    z.object({
      questionText: z.unknown(),
      responseType: z.enum(['multiple_choice', 'drag_and_drop']),
      answerScheme: z.enum([
        'single_choice',
        'situational_judgement_rating',
        'decision_making_binary_placement',
        'situational_judgement_most_least',
      ]),
      answerExplanation: z.unknown().nullable().optional(),
      difficulty: z.number().min(0).max(1).nullable().optional().describe(
        'Expected proportion incorrect on first exposure under realistic section timing. 0 is easiest, 1 is hardest, and null means unknown.',
      ),
      timeBurdenSeconds: AiTimeBurdenInputSchema,
      tagIds: z.array(z.string().uuid()).default([]),
      options: z.array(
        z.object({
          answerText: z.unknown(),
          answerExplanation: z.unknown().nullable().optional(),
          answerKeyValue: z.enum(['correct', 'yes', 'no', 'most', 'least']).nullable(),
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
  suggestedAnswerExplanation: z.string().nullable().optional(),
  suggestedChanges: z.string().nullable().optional(),
})

export const AiToolExplanationResponseSchema = z.object({
  updates: z.array(AiToolExplanationUpdateSchema).default([]),
})

export const AiToolWriteQuestionResponseSchema = z.object({
  questionText: z.string().min(1),
  answerExplanation: z.string().min(1),
  options: z.array(
    z.object({
      answerText: z.string().min(1),
      answerKeyValue: z.enum(['correct']).nullable(),
    })
  ).min(2).max(5),
  rationale: z.string().nullable().optional(),
})

export type AiToolQuestionStemPayload = z.infer<typeof AiToolQuestionStemPayloadSchema>
export type AiToolExplanationUpdate = z.infer<typeof AiToolExplanationUpdateSchema>

export type AiToolReviewFlag = {
  questionIndex: number
  message: string
  suggestedCorrectOptionIndex?: number | null
  suggestedAnswerExplanation?: string | null
  suggestedChanges?: string | null
}

const HOW_IMPORTANT_SCALE_OPTIONS = [
  'Very important',
  'Important',
  'Of minor importance',
  'Not important at all',
] as const

const HOW_APPROPRIATE_SCALE_OPTIONS = [
  'A very appropriate thing to do',
  'Appropriate, but not ideal',
  'Inappropriate, but not awful',
  'A very inappropriate thing to do',
] as const

export type ReviewFlagTextReplacement = {
  from: string
  to: string
}

export type ReviewFlagAcceptPlan =
  | { kind: 'correct_option'; optionIndex: number }
  | { kind: 'option_texts'; optionTexts: string[] }
  | { kind: 'text_replacement'; replacement: ReviewFlagTextReplacement }
  | { kind: 'text_replacement_choice'; from: string; options: string[] }

export function parseReviewFlagAcceptPlan(flag: AiToolReviewFlag): ReviewFlagAcceptPlan | null {
  if (flag.suggestedCorrectOptionIndex != null) {
    return { kind: 'correct_option', optionIndex: flag.suggestedCorrectOptionIndex }
  }

  const suggestedChanges = flag.suggestedChanges?.trim()
  if (!suggestedChanges) return null

  const letterAnswer =
    /(?:change(?:\s+the)?\s+(?:selected\s+)?answer\s+to|select(?:\s+option)?|correct(?:\s+answer)?(?:\s+(?:is|should\s+be))?)\s*([A-Ea-e])\b/i.exec(
      suggestedChanges
    )
  if (letterAnswer?.[1]) {
    return {
      kind: 'correct_option',
      optionIndex: letterAnswer[1].toUpperCase().charCodeAt(0) - 65,
    }
  }

  const eitherOr =
    /Replace\s+[“"']([^“"']+)[”"']\s+with\s+either\s+[“"']([^“"']+)[”"']\s+or\s+[“"']([^“"']+)[”"']/i.exec(
      suggestedChanges
    )
  if (eitherOr?.[1] && eitherOr[2] && eitherOr[3]) {
    return {
      kind: 'text_replacement_choice',
      from: eitherOr[1],
      options: [eitherOr[2], eitherOr[3]],
    }
  }

  const simpleReplace =
    /Replace\s+[“"']([^“"']+)[”"']\s+with\s+[“"']([^“"']+)[”"']/i.exec(suggestedChanges)
  if (simpleReplace?.[1] && simpleReplace[2]) {
    return {
      kind: 'text_replacement',
      replacement: { from: simpleReplace[1], to: simpleReplace[2] },
    }
  }

  if (/how important/i.test(suggestedChanges) && /options?|scale/i.test(suggestedChanges)) {
    const listed = extractListedOptionTexts(suggestedChanges)
    return {
      kind: 'option_texts',
      optionTexts: listed ?? [...HOW_IMPORTANT_SCALE_OPTIONS],
    }
  }

  if (/how appropriate/i.test(suggestedChanges) && /options?|scale/i.test(suggestedChanges)) {
    const listed = extractListedOptionTexts(suggestedChanges)
    return {
      kind: 'option_texts',
      optionTexts: listed ?? [...HOW_APPROPRIATE_SCALE_OPTIONS],
    }
  }

  const unquotedReplace =
    /Replace\s+(.+?)\s+with\s+(?:either\s+)?(.+?)(?:\s+and\b.*)?$/i.exec(suggestedChanges)
  if (
    unquotedReplace?.[1] &&
    unquotedReplace[2] &&
    !/how (important|appropriate)/i.test(suggestedChanges) &&
    !/options?/i.test(unquotedReplace[1])
  ) {
    const from = unquotedReplace[1].trim().replace(/^["“']|["”']$/g, '')
    const toRaw = unquotedReplace[2].trim()
    const eitherParts = /^(?:either\s+)?["“']?(.+?)["”']?\s+or\s+["“']?(.+?)["”']?$/i.exec(toRaw)
    if (eitherParts?.[1] && eitherParts[2]) {
      return {
        kind: 'text_replacement_choice',
        from,
        options: [eitherParts[1].trim(), eitherParts[2].trim()],
      }
    }
    const to = toRaw.replace(/^["“']|["”']$/g, '')
    if (from && to && from !== to) {
      return { kind: 'text_replacement', replacement: { from, to } }
    }
  }

  const listedOptions = extractListedOptionTexts(suggestedChanges)
  if (listedOptions) {
    return { kind: 'option_texts', optionTexts: listedOptions }
  }

  return null
}

function extractListedOptionTexts(suggestedChanges: string): string[] | null {
  const match =
    /(?:scale|options?)\s*:\s*(.+)$/i.exec(suggestedChanges.trim()) ??
    /:\s*((?:Very important|A very appropriate)[\s\S]+)$/i.exec(suggestedChanges.trim())
  if (!match?.[1]) return null
  const parts = match[1]
    .split(/[;•|\n]/)
    .map((part) => part.trim().replace(/^[A-Ea-e][.)]\s*/, '').replace(/\.$/, ''))
    .filter((part) => part.length > 0)
  return parts.length >= 2 ? parts : null
}

function replacePlainTextInRichText(value: unknown, from: string, to: string): Json {
  const plain = proseMirrorToPlainText(asJson(value)) ?? ''
  if (!plain.includes(from)) {
    return (value as Json) ?? plainTextToProseMirror('')
  }
  return plainTextToProseMirrorWithLineBreaks(plain.split(from).join(to))
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

function extractStemParagraphs(value: Json | null): Array<{ paragraphNumber: number; text: string }> {
  if (!value) return []
  if (typeof value === 'string') {
    return value
      .split(/\r?\n+/u)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text, index) => ({ paragraphNumber: index + 1, text }))
  }
  if (typeof value !== 'object' || Array.isArray(value)) return []

  const record = value as Record<string, unknown>
  const content = Array.isArray(record.content) ? record.content : []
  const paragraphs = content
    .map((node) => {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return ''
      const nodeRecord = node as Record<string, unknown>
      if (!['paragraph', 'heading', 'codeBlock'].includes(String(nodeRecord.type ?? ''))) return ''
      return extractTextFromRichJson(node as Parameters<typeof extractTextFromRichJson>[0]).trim()
    })
    .filter(Boolean)

  return paragraphs.map((text, index) => ({ paragraphNumber: index + 1, text }))
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
  const stemJson = asJson(stem.stemText)
  return {
    stemText: proseMirrorToPlainText(stemJson) ?? '',
    stemParagraphs: extractStemParagraphs(stemJson),
    questions: stem.questions.map((question, questionIndex) => ({
      questionIndex,
      questionText: proseMirrorToPlainText(asJson(question.questionText)) ?? '',
      responseType: question.responseType,
      answerScheme: question.answerScheme,
      answerExplanation: proseMirrorToPlainText(asJson(question.answerExplanation)) ?? '',
      selectedCorrectOptions: question.options
        .map((option, optionIndex) => ({
          optionIndex,
          label: String.fromCharCode(65 + optionIndex),
          answerText: proseMirrorToPlainText(asJson(option.answerText)) ?? '',
          answerKeyValue: option.answerKeyValue,
        }))
        .filter((option) => option.answerKeyValue != null),
      options: question.options.map((option, optionIndex) => ({
        optionIndex,
        label: String.fromCharCode(65 + optionIndex),
        answerText: proseMirrorToPlainText(asJson(option.answerText)) ?? '',
        answerKeyValue: option.answerKeyValue,
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

export function writtenQuestionToFormValue(
  response: z.infer<typeof AiToolWriteQuestionResponseSchema>,
  tagIds: string[] = []
): UcatQuestionStemFormValues['questions'][number] {
  return {
    questionText: plainTextToProseMirrorWithLineBreaks(response.questionText),
    responseType: 'multiple_choice',
    answerScheme: 'single_choice',
    answerExplanation: plainTextToProseMirror(response.answerExplanation),
    difficulty: null,
    timeBurdenSeconds: '',
    tagIds,
    sourceChannel: 'ai_generation',
    aiGenerationMetadata: null,
    options: response.options.map((option) => ({
      answerText: plainTextToProseMirror(option.answerText),
      answerExplanation: null,
      answerKeyValue: option.answerKeyValue,
    })),
  }
}

export function findMissingExplanations(
  stem: {
    questions: Array<{
      responseType: 'multiple_choice' | 'drag_and_drop'
      answerExplanation?: unknown
      options: Array<{ answerExplanation?: unknown }>
    }>
  },
  stemIndex?: number
): MissingExplanationTarget[] {
  const targets: MissingExplanationTarget[] = []
  stem.questions.forEach((question, questionIndex) => {
    if (question.responseType === 'drag_and_drop') {
      question.options.forEach((option, optionIndex) => {
        if (!hasRichTextContent((option.answerExplanation ?? null) as Json | null)) {
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
    if (!hasRichTextContent((question.answerExplanation ?? null) as Json | null)) {
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
      if (question.responseType === 'drag_and_drop') {
        const questionExplanation = update.answerExplanation?.trim()
        const shouldApplyQuestionExplanation =
          !hasRichTextContent(question.answerExplanation ?? null) && !!questionExplanation
        if (shouldApplyQuestionExplanation) appliedCount += 1
        return {
          ...question,
          answerExplanation: shouldApplyQuestionExplanation
            ? plainTextToProseMirror(questionExplanation)
            : question.answerExplanation,
          options: question.options.map((option, optionIndex) => {
            if (hasRichTextContent(option.answerExplanation ?? null)) return option
            const explanation = update.optionExplanations?.[optionIndex]?.trim()
            if (!explanation) return option
            appliedCount += 1
            return { ...option, answerExplanation: plainTextToProseMirror(explanation) }
          }),
        }
      }
      const questionExplanation = update.answerExplanation?.trim()
      const shouldApplyQuestionExplanation =
        !hasRichTextContent(question.answerExplanation ?? null) && !!questionExplanation
      if (shouldApplyQuestionExplanation) appliedCount += 1
      return {
        ...question,
        answerExplanation: shouldApplyQuestionExplanation
          ? plainTextToProseMirror(questionExplanation)
          : question.answerExplanation,
        options: question.options.map((option, optionIndex) => {
          if (hasRichTextContent(option.answerExplanation ?? null)) return option
          const optionExplanation = update.optionExplanations?.[optionIndex]?.trim()
          if (!optionExplanation) return option
          appliedCount += 1
          return {
            ...option,
            answerExplanation: plainTextToProseMirror(optionExplanation),
          }
        }),
      }
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
      suggestedAnswerExplanation: update.suggestedAnswerExplanation ?? null,
      suggestedChanges: update.suggestedChanges ?? null,
    }))
}

export function applyReviewFlagSuggestion(
  stem: UcatQuestionStemFormValues,
  flag: AiToolReviewFlag,
  options?: { textReplacementTo?: string }
): UcatQuestionStemFormValues {
  const question = stem.questions[flag.questionIndex]
  if (!question || question.answerScheme !== 'single_choice') {
    return stem
  }

  const plan = parseReviewFlagAcceptPlan(flag)
  if (!plan) return stem

  if (plan.kind === 'correct_option') {
    const suggestedOption = question.options[plan.optionIndex]
    if (!suggestedOption) return stem

    return {
      ...stem,
      questions: stem.questions.map((item, questionIndex) => {
        if (questionIndex !== flag.questionIndex) return item
        return {
          ...item,
          answerExplanation: flag.suggestedAnswerExplanation?.trim()
            ? plainTextToProseMirror(flag.suggestedAnswerExplanation.trim())
            : item.answerExplanation ?? null,
          options: item.options.map((option, optionIndex) => ({
            ...option,
            answerKeyValue: optionIndex === plan.optionIndex ? 'correct' : null,
          })),
        }
      }),
    }
  }

  if (plan.kind === 'option_texts') {
    return {
      ...stem,
      questions: stem.questions.map((item, questionIndex) => {
        if (questionIndex !== flag.questionIndex) return item
        const nextOptions = plan.optionTexts.map((text, optionIndex) => {
          const existing = item.options[optionIndex]
          return {
            answerText: plainTextToProseMirror(text),
            answerExplanation: existing?.answerExplanation ?? null,
            answerKeyValue: existing?.answerKeyValue ?? null,
          }
        })
        if (!nextOptions.some((option) => option.answerKeyValue === 'correct') && nextOptions[0]) {
          nextOptions[0] = { ...nextOptions[0], answerKeyValue: 'correct' }
        }
        return {
          ...item,
          options: nextOptions,
        }
      }),
    }
  }

  const replacement =
    plan.kind === 'text_replacement'
      ? plan.replacement
      : plan.kind === 'text_replacement_choice' && options?.textReplacementTo
        ? { from: plan.from, to: options.textReplacementTo }
        : null
  if (!replacement) return stem

  return {
    ...stem,
    questions: stem.questions.map((item, questionIndex) => {
      if (questionIndex !== flag.questionIndex) return item
      return {
        ...item,
        questionText: replacePlainTextInRichText(item.questionText, replacement.from, replacement.to),
        options: item.options.map((option) => ({
          ...option,
          answerText: replacePlainTextInRichText(option.answerText, replacement.from, replacement.to),
        })),
      }
    }),
  }
}
