import type { Json } from '@altitutor/shared'
import type { UcatQuestionStemFormValues } from '@/features/ucat/questions/types/schema'
import type { UcatAssessmentSnapshot } from '@/features/ucat/questions/lib/ai-assessment/schema'
import { proseMirrorToPlainText } from '@/features/ucat/shared/lib/rich-text'
import { parseTimeToSeconds } from '@/features/ucat/shared/lib/time-utils'
import { collectAssessmentImages } from './content'

function plain(value: Json | null | undefined): string {
  return proseMirrorToPlainText(value ?? null)?.trim() ?? ''
}

export function buildDraftUcatAssessmentSnapshot(params: {
  stemId: string
  values: UcatQuestionStemFormValues
  sectionName: string
  sectionNumber: number
  displayColumns: number
  categoryName: string | null
  tagNamesById: Map<string, string>
}): UcatAssessmentSnapshot {
  const questions = params.values.questions.map((question, questionIndex) => {
    if (!question.id) throw new Error(`Question ${questionIndex + 1} is missing its draft ID.`)
    const questionText = question.questionText as Json
    const answerExplanation = (question.answerExplanation ?? null) as Json | null
    return {
      id: question.id,
      index: questionIndex + 1,
      questionText,
      questionTextPlain: plain(questionText),
      answerExplanation,
      answerExplanationPlain: plain(answerExplanation),
      questionType: question.questionType,
      sourceChannel: question.sourceChannel ?? null,
      aiGenerationMetadata: question.aiGenerationMetadata ?? null,
      difficulty: question.difficulty ?? null,
      timeBurdenSeconds: parseTimeToSeconds(question.timeBurdenSeconds ?? ''),
      tagIds: question.tagIds ?? [],
      tagNames: (question.tagIds ?? []).map((id) => params.tagNamesById.get(id) ?? id),
      images: [
        ...collectAssessmentImages(questionText, `question:${question.id}:question_text`),
        ...collectAssessmentImages(answerExplanation, `question:${question.id}:answer_explanation`),
      ],
      options: question.options.map((option, optionIndex) => {
        if (!option.id) {
          throw new Error(`Question ${questionIndex + 1}, option ${optionIndex + 1} is missing its draft ID.`)
        }
        const answerText = option.answerText as Json
        const optionExplanation = (option.answerExplanation ?? null) as Json | null
        return {
          id: option.id,
          index: optionIndex + 1,
          answerText,
          answerTextPlain: plain(answerText),
          answerExplanation: optionExplanation,
          answerExplanationPlain: plain(optionExplanation),
          isAnswer: option.isAnswer,
          images: [
            ...collectAssessmentImages(answerText, `option:${option.id}:answer_text`),
            ...collectAssessmentImages(optionExplanation, `option:${option.id}:answer_explanation`),
          ],
        }
      }),
    }
  })
  const stemText = params.values.stemText as Json
  return {
    stemId: params.stemId,
    status: 'in_review',
    sourceChannel: 'bulk_import',
    sectionId: params.values.sectionId,
    sectionName: params.sectionName,
    sectionNumber: params.sectionNumber,
    displayColumns: params.displayColumns,
    categoryId: params.values.categoryId ?? null,
    categoryName: params.categoryName,
    accessScope: params.values.accessScope,
    stemText,
    stemTextPlain: plain(stemText),
    images: collectAssessmentImages(stemText, 'stem:stem_text'),
    questions,
  }
}
