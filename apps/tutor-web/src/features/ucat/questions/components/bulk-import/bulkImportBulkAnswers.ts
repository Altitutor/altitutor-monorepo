import type { Json } from '@altitutor/shared'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  parseAnswersTable,
  letterToOptionIndex,
  parseDecisionMakingAnswers,
} from '@/features/ucat/questions/lib/parseAnswersTable'
import { answerDocToPlainTsv } from '@/features/ucat/questions/lib/pmAnswerLineRanges'
import { plainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'

export function countFlatQuestions(stems: BulkImportStemDraft[]): number {
  return stems.reduce((sum, stem) => sum + (stem.values.questions?.length ?? 0), 0)
}

export function validateBulkAnswersDocument(
  pastedAnswersJson: Json | null | undefined,
  stems: BulkImportStemDraft[],
  isDecisionMakingSection: boolean
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
    const parsed = parseDecisionMakingAnswers(plain, flat.map((f) => f.questionType))
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

  const parsed = parseAnswersTable(plain)
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
  updateStem: (stemId: string, values: UcatQuestionStemFormValues) => void
): void {
  const flat: { stemId: string; questionIndex: number }[] = []
  stems.forEach((stem) => {
    const questions = stem.values.questions ?? []
    questions.forEach((_, qIdx) => flat.push({ stemId: stem.id, questionIndex: qIdx }))
  })
  if (flat.length === 0) return

  const updatesByStem = new Map<string, UcatQuestionStemFormValues>()
  const pastedAnswersPlain = answerDocToPlainTsv(pastedAnswersJson)

  if (isDecisionMakingSection) {
    const questionTypes = flat.map(({ stemId, questionIndex }) => {
      const stem = stems.find((s) => s.id === stemId)
      const q = stem?.values.questions?.[questionIndex] as { questionType?: string } | undefined
      return (q?.questionType === 'syllogism' ? 'syllogism' : 'multiple_choice') as
        | 'syllogism'
        | 'multiple_choice'
    })
    const dmParsed = parseDecisionMakingAnswers(pastedAnswersPlain, questionTypes)
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
            answer.optionExplanations?.[j]?.trim()
              ? (plainTextToProseMirror(answer.optionExplanations[j]!) as Json)
              : null,
        }))
        questions[questionIndex] = { ...q, syllogismAnswerPattern: pattern, options }
      } else if (answer.letter) {
        const optionIndex = letterToOptionIndex(answer.letter)
        const options = q.options.map((opt, j) => ({
          ...opt,
          isAnswer: j === optionIndex,
        }))
        const explanationText = answer.explanation?.trim() ?? ''
        questions[questionIndex] = {
          ...q,
          options,
          answerExplanation: explanationText
            ? (plainTextToProseMirror(explanationText) as Json)
            : null,
        }
      }
      nextValues = { ...nextValues, questions }
      updatesByStem.set(stemId, nextValues)
    })
  } else {
    const parsed = parseAnswersTable(pastedAnswersPlain)
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
      const explanationBody = row.explanation.trim()
      questions[questionIndex] = {
        ...q,
        options,
        answerExplanation: explanationBody
          ? (plainTextToProseMirror(explanationBody) as Json)
          : null,
      }
      nextValues = { ...nextValues, questions }
      updatesByStem.set(stemId, nextValues)
    })
  }

  updatesByStem.forEach((values, stemId) => updateStem(stemId, values))
}
