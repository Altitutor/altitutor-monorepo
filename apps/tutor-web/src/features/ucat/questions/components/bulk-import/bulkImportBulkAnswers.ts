import type { Json } from '@altitutor/shared'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  flattenBulkImportQuestions,
  type FlatQuestionRef,
} from '@/features/ucat/questions/components/bulk-import/bulkImportPerQuestionAnswers'
import {
  parseAnswersTable,
  letterToOptionIndex,
  parseDecisionMakingAnswers,
  type AnswerParseOptions,
} from '@/features/ucat/questions/lib/parseAnswersTable'
import {
  parseAnswersTableFromDoc,
  parseDecisionMakingAnswersFromDoc,
} from '@/features/ucat/questions/lib/parseAnswersFromDoc'
import { answerDocToPlainTsv } from '@/features/ucat/questions/lib/pmAnswerLineRanges'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export type QuestionAnswerPreview = {
  row: FlatQuestionRef
  questionText: string
  answerLetter: string | null
  syllogismPattern: string | null
  explanationPreview: string | null
  hasExplanation: boolean
  isParsed: boolean
}

function truncatePreview(text: string, maxLen: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= maxLen) return oneLine
  return `${oneLine.slice(0, maxLen)}…`
}

function questionTextForRow(stems: BulkImportStemDraft[], row: FlatQuestionRef): string {
  const stem = stems.find((s) => s.id === row.stemId)
  const q = stem?.values.questions?.[row.questionIndex]
  return proseMirrorToPlainText(q?.questionText ?? null)?.trim() ?? ''
}

function emptyPreview(stems: BulkImportStemDraft[], row: FlatQuestionRef): QuestionAnswerPreview {
  return {
    row,
    questionText: questionTextForRow(stems, row),
    answerLetter: null,
    syllogismPattern: null,
    explanationPreview: null,
    hasExplanation: false,
    isParsed: false,
  }
}

/** Live preview of parsed bulk answers aligned to wizard questions (paste order). */
export function buildQuestionAnswerPreviews(
  stems: BulkImportStemDraft[],
  pastedAnswersJson: Json | null | undefined,
  isDecisionMakingSection: boolean,
  answerParseOptions?: AnswerParseOptions
): QuestionAnswerPreview[] {
  const flat = flattenBulkImportQuestions(stems)
  const plain = answerDocToPlainTsv(pastedAnswersJson)?.trim() ?? ''

  if (!plain) {
    return flat.map((row) => emptyPreview(stems, row))
  }

  if (isDecisionMakingSection) {
    const questionTypes = flat.map((row) =>
      row.isSyllogism ? ('syllogism' as const) : ('multiple_choice' as const)
    )
    const parsed = parseDecisionMakingAnswersFromDoc(
      pastedAnswersJson,
      questionTypes,
      answerParseOptions
    )
    return flat.map((row, index) => {
      const answer = parsed[index]
      if (!answer) return emptyPreview(stems, row)

      if (row.isSyllogism && answer.pattern) {
        const optionExplanations = answer.optionExplanations ?? []
        const firstExplanation =
          (answer.explanation ?? '').trim() ||
          optionExplanations.map((e) => (e ?? '').trim()).find((e) => e.length > 0) ||
          ''
        return {
          row,
          questionText: questionTextForRow(stems, row),
          answerLetter: null,
          syllogismPattern: answer.pattern.split('').join(' · '),
          explanationPreview: firstExplanation ? truncatePreview(firstExplanation, 120) : null,
          hasExplanation:
            firstExplanation.length > 0 ||
            optionExplanations.some((e) => (e ?? '').trim().length > 0),
          isParsed: true,
        }
      }

      if (answer.letter) {
        const explanation = answer.explanation?.trim() ?? ''
        return {
          row,
          questionText: questionTextForRow(stems, row),
          answerLetter: answer.letter.toUpperCase(),
          syllogismPattern: null,
          explanationPreview: explanation ? truncatePreview(explanation, 120) : null,
          hasExplanation: explanation.length > 0,
          isParsed: true,
        }
      }

      return emptyPreview(stems, row)
    })
  }

  const parsed = parseAnswersTableFromDoc(pastedAnswersJson, answerParseOptions)
  return flat.map((row, index) => {
    const answer = parsed[index]
    if (!answer) return emptyPreview(stems, row)
    const explanation =
      proseMirrorToPlainText(answer.explanationDoc)?.trim() || answer.explanation.trim()
    return {
      row,
      questionText: questionTextForRow(stems, row),
      answerLetter: answer.letter.toUpperCase(),
      syllogismPattern: null,
      explanationPreview: explanation ? truncatePreview(explanation, 120) : null,
      hasExplanation: explanation.length > 0,
      isParsed: true,
    }
  })
}

export function countFlatQuestions(stems: BulkImportStemDraft[]): number {
  return stems.reduce((sum, stem) => sum + (stem.values.questions?.length ?? 0), 0)
}

export function validateBulkAnswersDocument(
  pastedAnswersJson: Json | null | undefined,
  stems: BulkImportStemDraft[],
  isDecisionMakingSection: boolean,
  answerParseOptions?: AnswerParseOptions
): { ok: true } | { ok: false; message: string } {
  const totalQuestions = countFlatQuestions(stems)
  if (totalQuestions === 0) {
    return { ok: false, message: 'No questions to match answers against.' }
  }

  const plain = answerDocToPlainTsv(pastedAnswersJson)
  if (!plain.trim()) {
    return { ok: false, message: 'Paste an answers document before continuing.' }
  }

  if (isDecisionMakingSection) {
    const flat: { questionType: 'syllogism' | 'multiple_choice' }[] = []
    stems.forEach((stem) => {
      ;(stem.values.questions ?? []).forEach((q) => {
        flat.push({
          questionType:
            (q as { questionType?: string }).questionType === 'syllogism'
              ? 'syllogism'
              : 'multiple_choice',
        })
      })
    })
    const parsed = parseDecisionMakingAnswers(plain, flat.map((f) => f.questionType), answerParseOptions)
    if (parsed.length !== totalQuestions) {
      return {
        ok: false,
        message: `Expected ${totalQuestions} answers but found ${parsed.length}.`,
      }
    }
    const missingExplanation = parsed.some((row, i) => {
      const isSyllogism = flat[i]?.questionType === 'syllogism'
      if (isSyllogism) {
        return !(row.optionExplanations ?? []).some((e) => (e ?? '').trim().length > 0)
      }
      return !(row.explanation ?? '').trim()
    })
    if (missingExplanation) {
      return { ok: false, message: 'Every question must have an explanation in the answers document.' }
    }
    return { ok: true }
  }

  const parsed = parseAnswersTable(plain, answerParseOptions)
  if (parsed.length !== totalQuestions) {
    return {
      ok: false,
      message: `Expected ${totalQuestions} answers but found ${parsed.length}.`,
    }
  }
  const missingExplanation = parsed.some((row) => !row.explanation.trim())
  if (missingExplanation) {
    return { ok: false, message: 'Every question must have an explanation in the answers document.' }
  }
  return { ok: true }
}

export function applyBulkAnswersToStems(
  pastedAnswersJson: Json | null | undefined,
  stems: BulkImportStemDraft[],
  isDecisionMakingSection: boolean,
  updateStem: (stemId: string, values: UcatQuestionStemFormValues) => void,
  answerParseOptions?: AnswerParseOptions
): void {
  const flat: { stemId: string; questionIndex: number }[] = []
  stems.forEach((stem) => {
    const questions = stem.values.questions ?? []
    questions.forEach((_, qIdx) => flat.push({ stemId: stem.id, questionIndex: qIdx }))
  })
  if (flat.length === 0) return

  const updatesByStem = new Map<string, UcatQuestionStemFormValues>()

  if (isDecisionMakingSection) {
    const questionTypes = flat.map(({ stemId, questionIndex }) => {
      const stem = stems.find((s) => s.id === stemId)
      const q = stem?.values.questions?.[questionIndex] as { questionType?: string } | undefined
      return (q?.questionType === 'syllogism' ? 'syllogism' : 'multiple_choice') as
        | 'syllogism'
        | 'multiple_choice'
    })
    const dmParsed = parseDecisionMakingAnswersFromDoc(
      pastedAnswersJson,
      questionTypes,
      answerParseOptions
    )
    dmParsed.forEach((answer, i) => {
      if (i >= flat.length) return
      const { stemId, questionIndex } = flat[i]!
      const stem = stems.find((s) => s.id === stemId)
      if (!stem) return
      let nextValues = updatesByStem.get(stemId)
      if (!nextValues) nextValues = { ...stem.values, questions: [...(stem.values.questions ?? [])] }
      const questions = [...(nextValues.questions ?? [])]
      const q = questions[questionIndex]
      if (!q || !q.options) return
      const qWithPattern = q as typeof q & { syllogismAnswerPattern?: string | null }
      if (answer.pattern && qWithPattern.questionType === 'syllogism') {
        const pattern = answer.pattern
        const options = (q.options ?? []).map((opt, j) => ({
          ...opt,
          isAnswer: pattern.charAt(j).toUpperCase() === 'Y',
          answerExplanation:
            answer.optionExplanationDocs?.[j] ??
            null,
        }))
        questions[questionIndex] = { ...q, syllogismAnswerPattern: pattern, options }
      } else if (answer.letter) {
        const optionIndex = letterToOptionIndex(answer.letter)
        const options = q.options.map((opt, j) => ({
          ...opt,
          isAnswer: j === optionIndex,
        }))
        questions[questionIndex] = {
          ...q,
          options,
          answerExplanation: answer.explanationDoc ?? null,
        }
      }
      nextValues = { ...nextValues, questions }
      updatesByStem.set(stemId, nextValues)
    })
  } else {
    const parsed = parseAnswersTableFromDoc(pastedAnswersJson, answerParseOptions)
    parsed.forEach((row, i) => {
      if (i >= flat.length) return
      const { stemId, questionIndex } = flat[i]!
      const stem = stems.find((s) => s.id === stemId)
      if (!stem) return
      let nextValues = updatesByStem.get(stemId)
      if (!nextValues) nextValues = { ...stem.values, questions: [...(stem.values.questions ?? [])] }
      const questions = [...(nextValues.questions ?? [])]
      const q = questions[questionIndex]
      if (!q || !q.options) return
      const optionIndex = letterToOptionIndex(row.letter)
      const options = q.options.map((opt, j) => ({
        ...opt,
        isAnswer: j === optionIndex,
      }))
      questions[questionIndex] = {
        ...q,
        options,
        answerExplanation: row.explanationDoc ?? null,
      }
      nextValues = { ...nextValues, questions }
      updatesByStem.set(stemId, nextValues)
    })
  }

  updatesByStem.forEach((values, stemId) => updateStem(stemId, values))
}
