import type { UcatEnginePreviewQuestion } from '@/features/ucat/question-engine-preview/UcatQuestionEnginePreview'
import {
  extractTextFromRichJson,
  type JsonLike,
} from '@/features/ucat/shared/lib/rich-text'

type SnapshotOption = {
  id: string
  index: number
  answerText: unknown
  answerExplanation?: unknown
  isAnswer: boolean
}

export type UcatAttemptContentSnapshot = {
  schemaVersion: number
  stem: {
    id: string
    sectionNumber?: number | null
    sectionName?: string | null
    sectionDisplayColumns?: number | null
    categoryId?: string | null
    categoryName?: string | null
    categoryDescription?: unknown
    stemText: unknown
  }
  question: {
    id: string
    questionText: unknown
    answerExplanation?: unknown
    index: number
    difficulty?: number | null
    timeBurdenSeconds?: number | null
    questionType: 'multiple_choice' | 'syllogism'
    tags?: Array<{ id?: string; name?: string; description?: unknown }>
  }
  answerOptions: SnapshotOption[]
}

export type AttemptReviewQuestion = UcatEnginePreviewQuestion & {
  stemId: string
  questionSetId: string
}

export function parseAttemptContentSnapshot(
  value: unknown
): UcatAttemptContentSnapshot | null {
  if (!value || typeof value !== 'object') return null
  const snapshot = value as Partial<UcatAttemptContentSnapshot>
  if (!snapshot.stem?.id || !snapshot.question?.id) return null
  if (
    snapshot.question.questionType !== 'multiple_choice' &&
    snapshot.question.questionType !== 'syllogism'
  ) {
    return null
  }
  return {
    ...snapshot,
    schemaVersion: snapshot.schemaVersion ?? 1,
    stem: snapshot.stem,
    question: snapshot.question,
    answerOptions: Array.isArray(snapshot.answerOptions)
      ? snapshot.answerOptions
      : [],
  }
}

function richJson(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

export function snapshotToReviewQuestion(
  snapshot: UcatAttemptContentSnapshot,
  questionNumber: number,
  questionSetId: string
): AttemptReviewQuestion {
  return {
    id: snapshot.question.id,
    stemId: snapshot.stem.id,
    questionSetId,
    questionNumber,
    sectionDisplayColumns:
      snapshot.stem.sectionDisplayColumns === 2 ? 2 : 1,
    stemText: extractTextFromRichJson(snapshot.stem.stemText as JsonLike),
    stemJson: richJson(snapshot.stem.stemText),
    questionText: extractTextFromRichJson(
      snapshot.question.questionText as JsonLike
    ),
    questionJson: richJson(snapshot.question.questionText),
    questionType: snapshot.question.questionType,
    options: [...snapshot.answerOptions]
      .sort((a, b) => a.index - b.index)
      .map((option) => ({
        id: option.id,
        index: option.index,
        text: extractTextFromRichJson(option.answerText as JsonLike),
        answerJson: richJson(option.answerText),
        isAnswer: option.isAnswer,
        answerExplanation: extractTextFromRichJson(
          option.answerExplanation as JsonLike
        ),
        answerExplanationJson: richJson(option.answerExplanation),
      })),
    answerExplanation: extractTextFromRichJson(
      snapshot.question.answerExplanation as JsonLike
    ),
    answerExplanationJson: richJson(snapshot.question.answerExplanation),
  }
}

export function parseSyllogismAnswerSnapshot(
  value: unknown
): Record<string, boolean> | null {
  if (!value || typeof value !== 'object') return null
  const snapshot = value as Record<string, unknown>
  if (snapshot.type !== 'syllogism_v1' || !Array.isArray(snapshot.answers)) {
    return null
  }
  const answers: Record<string, boolean> = {}
  for (const item of snapshot.answers) {
    if (!item || typeof item !== 'object') continue
    const answer = item as Record<string, unknown>
    if (
      typeof answer.question_answer_option_id === 'string' &&
      typeof answer.answer === 'boolean'
    ) {
      answers[answer.question_answer_option_id] = answer.answer
    }
  }
  return Object.keys(answers).length > 0 ? answers : null
}

export function resultForAttempt(
  score: number | null,
  questionType: 'multiple_choice' | 'syllogism' | null,
  hasAttempt: boolean
): 'correct' | 'partial' | 'incorrect' | 'not_attempted' {
  if (!hasAttempt || score == null) return 'not_attempted'
  const maxScore = questionType === 'syllogism' ? 2 : 1
  if (score >= maxScore) return 'correct'
  return score > 0 ? 'partial' : 'incorrect'
}
