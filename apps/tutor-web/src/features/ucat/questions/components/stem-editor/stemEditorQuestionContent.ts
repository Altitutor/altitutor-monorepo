import type { Json } from '@altitutor/shared'
import { EMPTY_DOC } from '@/features/ucat/questions/constants/stemFormConstants'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'

export function trimTextParagraphs(text: string): string {
  return text
    .split(/\n/)
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/^\s*\n+/, '')
    .replace(/\n+\s*$/, '')
    .trim()
}

type QuestionFormItem = UcatQuestionStemFormValues['questions'][number]

export function stemEditorQuestionHasContent(question: QuestionFormItem | undefined): boolean {
  if (!question) return false

  const hasQuestionText =
    trimTextParagraphs(proseMirrorToPlainText((question.questionText as Json) ?? EMPTY_DOC) ?? '') !== ''

  const hasOptionContent = (question.options ?? []).some((opt) => {
    const answerText = trimTextParagraphs(
      proseMirrorToPlainText((opt.answerText as Json) ?? EMPTY_DOC) ?? '',
    )
    const answerExplanation = opt.answerExplanation
      ? trimTextParagraphs(proseMirrorToPlainText((opt.answerExplanation as Json) ?? EMPTY_DOC) ?? '')
      : ''
    return answerText !== '' || answerExplanation !== ''
  })

  return hasQuestionText || hasOptionContent
}
