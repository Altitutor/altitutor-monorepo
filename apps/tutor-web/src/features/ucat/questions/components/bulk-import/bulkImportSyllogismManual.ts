import type { Json } from '@altitutor/shared'
import { proseMirrorToPlainText, tokenizedPlainTextToProseMirror } from '@/features/ucat/shared/lib/rich-text'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import {
  isSyllogismManualEntryPlaceholder,
  SYLLOGISM_IMAGE_PLACEHOLDER_LINES,
} from '@/features/ucat/questions/lib/parsers/decisionMaking'
import type { BulkImportStemDraft } from '@/features/ucat/questions/hooks/useBulkImportWizard'

export type SyllogismManualEntryTarget = {
  targetId: string
  stemId: string
  stemIndex: number
  questionIndex: number
  questionNumber: number
  questionText: string
  statements: string[]
}

function optionNeedsManualEntry(answerText: Json): boolean {
  return isSyllogismManualEntryPlaceholder(proseMirrorToPlainText(answerText))
}

export function collectSyllogismManualEntryTargets(
  stems: BulkImportStemDraft[]
): SyllogismManualEntryTarget[] {
  const targets: SyllogismManualEntryTarget[] = []

  stems.forEach((stem, stemIndex) => {
    stem.values.questions.forEach((question, questionIndex) => {
      if (question.questionType !== 'syllogism') return
      const options = question.options ?? []
      const needsManual =
        options.length !== 5 || options.some((option) => optionNeedsManualEntry(option.answerText))
      if (!needsManual) return

      const statements =
        options.length === 5
          ? options.map((option) => {
              const text = proseMirrorToPlainText(option.answerText)
              return optionNeedsManualEntry(option.answerText) ? '' : text
            })
          : ['', '', '', '', '']

      targets.push({
        targetId: `${stem.id}:${questionIndex}`,
        stemId: stem.id,
        stemIndex,
        questionIndex,
        questionNumber: questionIndex + 1,
        questionText: proseMirrorToPlainText(question.questionText),
        statements,
      })
    })
  })

  return targets
}

export function syllogismManualEntryIsComplete(targets: SyllogismManualEntryTarget[]): boolean {
  return targets.every((target) =>
    target.statements.every((statement) => statement.trim().length >= 3)
  )
}

export function applySyllogismManualEntryTargets(
  stems: BulkImportStemDraft[],
  targets: SyllogismManualEntryTarget[]
): UcatQuestionStemFormValues[] {
  const targetsByStemQuestion = new Map(
    targets.map((target) => [`${target.stemId}:${target.questionIndex}`, target] as const)
  )

  return stems.map((stem) => {
    const questions = stem.values.questions.map((question, questionIndex) => {
      const target = targetsByStemQuestion.get(`${stem.id}:${questionIndex}`)
      if (!target || question.questionType !== 'syllogism') return question

      return {
        ...question,
        options: target.statements.map((statement) => ({
          answerText: tokenizedPlainTextToProseMirror(statement.trim()) as Json,
          answerExplanation: null,
          isAnswer: false,
        })),
      }
    })

    return { ...stem.values, questions }
  })
}

export { SYLLOGISM_IMAGE_PLACEHOLDER_LINES }
