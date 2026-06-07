import type { Json } from '@altitutor/shared'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import type { UcatEnginePreviewQuestion } from '@/features/ucat/question-engine-preview/UcatQuestionEnginePreview'

function cleanRichExplanationPlain(json: Json | null | undefined): string | undefined {
  const raw = proseMirrorToPlainText(json)?.trim() ?? ''
  const clean = raw.toLowerCase() === 'paragraph' ? '' : raw
  return clean || undefined
}

/** First argument wins; use selected section columns, then saved stem (e.g. edit dialog). */
export function resolveSectionDisplayColumns(
  sectionDisplayColumns: number | null | undefined,
  sectionFromForm: { display_columns?: number | null } | null | undefined
): 1 | 2 {
  const raw = sectionDisplayColumns ?? sectionFromForm?.display_columns ?? 1
  return raw === 2 ? 2 : 1
}

/** Builds a preview model for UcatQuestionEnginePreview from tutor stem form values. */
export function stemFormValuesToEnginePreviewQuestion(
  values: UcatQuestionStemFormValues,
  questionIndex: number,
  sectionDisplayColumns: 1 | 2
): UcatEnginePreviewQuestion | null {
  const q = values.questions[questionIndex]
  if (!q) return null

  const stemJson =
    values.stemText != null && typeof values.stemText === 'object'
      ? (values.stemText as Record<string, unknown>)
      : null
  const questionJson =
    q.questionText != null && typeof q.questionText === 'object'
      ? (q.questionText as Record<string, unknown>)
      : null

  const options = (q.options ?? []).map((opt, index) => ({
    id: `preview-opt-${questionIndex}-${index}`,
    index,
    text: proseMirrorToPlainText(opt.answerText)?.trim() ?? '',
    answerJson:
      opt.answerText != null && typeof opt.answerText === 'object'
        ? (opt.answerText as Record<string, unknown>)
        : null,
    isAnswer: opt.isAnswer,
    answerExplanation: cleanRichExplanationPlain(opt.answerExplanation ?? null),
    answerExplanationJson:
      opt.answerExplanation != null && typeof opt.answerExplanation === 'object'
        ? (opt.answerExplanation as Record<string, unknown>)
        : null,
  }))

  const syllogismPattern = (q as { syllogismAnswerPattern?: string | null }).syllogismAnswerPattern ?? null
  const isSyllogism = q.questionType === 'syllogism'

  const resolvedOptions =
    isSyllogism && syllogismPattern && syllogismPattern.length === options.length
      ? options.map((opt, index) => ({
          ...opt,
          isAnswer: syllogismPattern.charAt(index).toUpperCase() === 'Y',
        }))
      : options

  return {
    id: `preview-q-${questionIndex}`,
    questionNumber: questionIndex + 1,
    sectionDisplayColumns,
    stemText: proseMirrorToPlainText(values.stemText)?.trim() ?? '',
    stemJson,
    questionText: proseMirrorToPlainText(q.questionText)?.trim() ?? '',
    questionJson,
    questionType: q.questionType,
    options: resolvedOptions,
    answerExplanation: cleanRichExplanationPlain(q.answerExplanation ?? null),
    answerExplanationJson:
      q.answerExplanation != null && typeof q.answerExplanation === 'object'
        ? (q.answerExplanation as Record<string, unknown>)
        : null,
  }
}
