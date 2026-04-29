import type {
  AiImportDraftStemPayload,
  AiImportExtractResponse,
  AiImportIssue,
  AiImportSectionKey,
} from '@/features/ucat/questions/lib/ai-import/schema'

function issue(code: AiImportIssue['code'], message: string, severity: AiImportIssue['severity']): AiImportIssue {
  return { code, message, severity }
}

function expectedOptionRange(section: AiImportSectionKey): { min: number; max: number } {
  if (section === 'decision_making') return { min: 2, max: 6 }
  return { min: 4, max: 6 }
}

export function validateAiExtraction(
  extraction: AiImportExtractResponse,
  section: AiImportSectionKey,
  estimatedQuestions: number
): AiImportIssue[] {
  const issues: AiImportIssue[] = []
  if (extraction.status === 'rejected') return issues
  if (extraction.stems.length === 0) {
    issues.push(issue('format_mismatch', 'No stems were extracted from the source.', 'high'))
    return issues
  }

  const { min, max } = expectedOptionRange(section)
  let totalQuestions = 0

  for (const stem of extraction.stems) {
    for (const question of stem.questions) {
      totalQuestions += 1
      const correctCount = question.options.filter((option) => option.isAnswer).length
      if (question.questionType === 'multiple_choice' && correctCount !== 1) {
        issues.push(
          issue(
            'ambiguous_answer',
            'A multiple-choice question has zero or multiple correct answers.',
            'high'
          )
        )
      }
      if (question.options.length < min || question.options.length > max) {
        issues.push(
          issue(
            'format_mismatch',
            `A question has ${question.options.length} options; expected ${min}-${max}.`,
            'medium'
          )
        )
      }
      if (question.confidence < 0.45) {
        issues.push(issue('low_confidence', 'A question was extracted with low confidence.', 'medium'))
      }
    }
  }

  if (estimatedQuestions > 0 && totalQuestions === 0) {
    issues.push(issue('format_mismatch', 'No questions were extracted from the document.', 'high'))
  } else if (estimatedQuestions > 0) {
    const delta = Math.abs(totalQuestions - estimatedQuestions)
    if (delta >= Math.max(3, Math.ceil(estimatedQuestions * 0.4))) {
      issues.push(
        issue(
          'format_mismatch',
          'Extracted question count differs significantly from pre-parse estimate.',
          'medium'
        )
      )
    }
  }

  return issues
}

export function countDraftMissingAnswers(stems: AiImportDraftStemPayload[]): number {
  return stems.reduce((sum, stem) => {
    return (
      sum +
      stem.questions.reduce((questionSum, question) => {
        const hasAnswer = question.options.some((option) => option.isAnswer)
        return questionSum + (hasAnswer ? 0 : 1)
      }, 0)
    )
  }, 0)
}
