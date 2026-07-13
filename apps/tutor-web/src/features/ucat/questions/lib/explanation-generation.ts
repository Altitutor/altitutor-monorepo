import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { AiToolQuestionStemPayload } from '@/features/ucat/questions/lib/ai-tools'
import { findMissingExplanations } from '@/features/ucat/questions/lib/ai-tools'

export function formValuesToExplanationStemPayload(
  values: UcatQuestionStemFormValues,
): AiToolQuestionStemPayload {
  return {
    sectionId: values.sectionId,
    categoryId: values.categoryId ?? null,
    stemText: values.stemText,
    isPrivate: values.isPrivate,
    questions: values.questions.map((question) => ({
      questionText: question.questionText,
      questionType: question.questionType,
      answerExplanation: question.answerExplanation ?? null,
      difficulty: question.difficulty ?? null,
      timeBurdenSeconds: question.timeBurdenSeconds ?? null,
      tagIds: question.tagIds ?? [],
      options: question.options.map((option) => ({
        answerText: option.answerText,
        answerExplanation: option.answerExplanation ?? null,
        isAnswer: option.isAnswer,
      })),
    })),
  }
}

export function stemNeedsExplanationGeneration(values: UcatQuestionStemFormValues): boolean {
  return findMissingExplanations(values).length > 0
}
