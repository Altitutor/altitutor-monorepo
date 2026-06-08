import type { Json } from '@altitutor/shared'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export type ExplanationScope = 'question' | 'per_option'

export type PerQuestionAnswerDraft = {
  correctOptionIndex: number | null
  syllogismPattern: string | null
  explanationScope: ExplanationScope
  questionExplanation: Json | null
  optionExplanations: Array<Json | null>
}

export type FlatQuestionRef = {
  stemId: string
  stemIndex: number
  questionIndex: number
  globalIndex: number
  label: string
  isSyllogism: boolean
  optionCount: number
}

export function flattenBulkImportQuestions(stems: BulkImportStemDraft[]): FlatQuestionRef[] {
  const flat: FlatQuestionRef[] = []
  let globalIndex = 0
  stems.forEach((stem, stemIndex) => {
    const questions = stem.values.questions ?? []
    questions.forEach((q, questionIndex) => {
      flat.push({
        stemId: stem.id,
        stemIndex,
        questionIndex,
        globalIndex,
        label: `Stem ${stemIndex + 1} · Q${questionIndex + 1}`,
        isSyllogism: (q as { questionType?: string }).questionType === 'syllogism',
        optionCount: q.options?.length ?? 0,
      })
      globalIndex += 1
    })
  })
  return flat
}

export function createDefaultPerQuestionAnswers(
  flat: FlatQuestionRef[]
): PerQuestionAnswerDraft[] {
  return flat.map((row) => ({
    correctOptionIndex: null,
    syllogismPattern: row.isSyllogism
      ? 'N'.repeat(Math.max(row.optionCount, 5)).slice(0, row.optionCount)
      : null,
    explanationScope: row.isSyllogism ? 'per_option' : 'question',
    questionExplanation: null,
    optionExplanations: Array.from({ length: row.optionCount }, () => null),
  }))
}

function hasRichTextContent(value: Json | null | undefined): boolean {
  return (proseMirrorToPlainText(value ?? null)?.trim() ?? '').length > 0
}

export function isPerQuestionAnswerComplete(
  row: FlatQuestionRef,
  draft: PerQuestionAnswerDraft
): boolean {
  if (row.isSyllogism) {
    const pattern = draft.syllogismPattern ?? ''
    if (pattern.length < row.optionCount) return false
    if (draft.explanationScope === 'per_option') {
      return draft.optionExplanations.some((e) => hasRichTextContent(e))
    }
    return hasRichTextContent(draft.questionExplanation)
  }
  if (draft.correctOptionIndex == null) return false
  if (draft.explanationScope === 'per_option') {
    return draft.optionExplanations.some((e) => hasRichTextContent(e))
  }
  return hasRichTextContent(draft.questionExplanation)
}

export function applyPerQuestionAnswersToStems(
  stems: BulkImportStemDraft[],
  flat: FlatQuestionRef[],
  drafts: PerQuestionAnswerDraft[],
  updateStem: (stemId: string, values: UcatQuestionStemFormValues) => void
): void {
  const updatesByStem = new Map<string, UcatQuestionStemFormValues>()

  flat.forEach((row, i) => {
    const draft = drafts[i]
    if (!draft) return
    const stem = stems.find((s) => s.id === row.stemId)
    if (!stem) return

    let nextValues = updatesByStem.get(row.stemId)
    if (!nextValues) {
      nextValues = { ...stem.values, questions: [...(stem.values.questions ?? [])] }
    }
    const questions = [...(nextValues.questions ?? [])]
    const q = questions[row.questionIndex]
    if (!q || !q.options) return

    if (row.isSyllogism) {
      const pattern = (draft.syllogismPattern ?? '').slice(0, q.options.length)
      const options = q.options.map((opt, j) => ({
        ...opt,
        isAnswer: pattern.charAt(j).toUpperCase() === 'Y',
        answerExplanation:
          draft.explanationScope === 'per_option'
            ? (draft.optionExplanations[j] ?? null)
            : null,
      }))
      questions[row.questionIndex] = {
        ...q,
        syllogismAnswerPattern: pattern,
        options,
        answerExplanation:
          draft.explanationScope === 'question' ? draft.questionExplanation : null,
      } as typeof q
    } else {
      const correctIndex = draft.correctOptionIndex ?? 0
      const options = q.options.map((opt, j) => ({
        ...opt,
        isAnswer: j === correctIndex,
        answerExplanation:
          draft.explanationScope === 'per_option'
            ? (draft.optionExplanations[j] ?? null)
            : null,
      }))
      questions[row.questionIndex] = {
        ...q,
        options,
        answerExplanation:
          draft.explanationScope === 'question' ? draft.questionExplanation : null,
      }
    }

    nextValues = { ...nextValues, questions }
    updatesByStem.set(row.stemId, nextValues)
  })

  updatesByStem.forEach((values, stemId) => updateStem(stemId, values))
}
