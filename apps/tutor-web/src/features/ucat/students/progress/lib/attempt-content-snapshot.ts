import type { UcatEnginePreviewQuestion } from '@/features/ucat/question-engine-preview/UcatQuestionEnginePreview'
import {
  compileResponseContract,
  evaluateResponse,
  getAnswerSchemeMaximum,
  type AnswerScheme,
  type CandidateResponse,
  type ReviewContract,
} from '@altitutor/ucat-response-contract'
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
  answerKeyValue?: 'correct' | 'yes' | 'no' | 'most' | 'least' | null
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
    responseType?: 'multiple_choice' | 'drag_and_drop'
    answerScheme?: AnswerScheme['kind']
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
    responseType: snapshot.question.responseType,
    answerScheme: snapshot.question.answerScheme,
    options: [...snapshot.answerOptions]
      .sort((a, b) => a.index - b.index)
      .map((option) => ({
        id: option.id,
        index: option.index,
        text: extractTextFromRichJson(option.answerText as JsonLike),
        answerJson: richJson(option.answerText),
        isAnswer: option.isAnswer,
        answerKeyValue: option.answerKeyValue ?? null,
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
  if (snapshot.type === 'ucat_response_v1') {
    const response = snapshot.response
    if (!response || typeof response !== 'object') return null
    const placements = (response as Record<string, unknown>).placements
    if (!placements || typeof placements !== 'object') return null
    return Object.fromEntries(
      Object.entries(placements as Record<string, unknown>).flatMap(
        ([optionId, token]) =>
          token === 'yes' || token === 'no'
            ? [[optionId, token === 'yes']]
            : []
      )
    )
  }
  if (snapshot.type !== 'syllogism_v1' || !Array.isArray(snapshot.answers)) return null
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
  answerScheme: AnswerScheme['kind'] | null | undefined,
  hasAttempt: boolean
): 'correct' | 'partial' | 'incorrect' | 'not_attempted' {
  if (!hasAttempt || score == null) return 'not_attempted'
  const maxScore = answerScheme ? getAnswerSchemeMaximum(answerScheme) : 1
  if (score >= maxScore) return 'correct'
  return score > 0 ? 'partial' : 'incorrect'
}

export function projectAttemptReview(params: {
  question: AttemptReviewQuestion
  selectedOptionId?: string | null
  binaryPlacements?: Record<string, boolean> | null
}): ReviewContract {
  const { question } = params
  const kind = question.answerScheme ?? 'single_choice'
  const keyedOptionId = (key: 'correct' | 'most' | 'least') =>
    question.options.find((option) => option.answerKeyValue === key)?.id ?? ''
  const answerScheme: AnswerScheme =
    kind === 'decision_making_binary_placement'
      ? {
          kind,
          correctByOptionId: Object.fromEntries(
            question.options.map((option) => [
              option.id,
              option.answerKeyValue
                ? option.answerKeyValue === 'yes'
                  ? 'yes'
                  : 'no'
                : option.isAnswer
                  ? 'yes'
                  : 'no',
            ])
          ),
        }
      : kind === 'situational_judgement_most_least'
        ? {
            kind,
            mostAppropriateOptionId: keyedOptionId('most'),
            leastAppropriateOptionId: keyedOptionId('least'),
          }
        : {
            kind,
            correctOptionId:
              keyedOptionId('correct') ||
              question.options.find((option) => option.isAnswer)?.id ||
              '',
          }
  const compiled = compileResponseContract({
    questionId: question.id,
    responseType:
      question.responseType ??
      (kind === 'single_choice' || kind === 'situational_judgement_rating'
        ? 'multiple_choice'
        : 'drag_and_drop'),
    answerScheme,
    options: question.options.map(({ id, index }) => ({ id, index })),
  })
  if (!compiled.ok) {
    throw new Error(compiled.issues.map((issue) => issue.message).join(' '))
  }
  const response: CandidateResponse =
    compiled.contract.presentation.kind === 'single_select'
      ? {
          kind: 'single_select',
          selectedOptionId: params.selectedOptionId ?? null,
        }
      : {
          kind: 'placement',
          placements: Object.fromEntries(
            Object.entries(params.binaryPlacements ?? {}).map(
              ([optionId, value]) => [optionId, value ? 'yes' : 'no']
            )
          ),
        }
  const evaluation = evaluateResponse(compiled.contract, response)
  if (!evaluation.ok) {
    throw new Error(evaluation.issues.map((issue) => issue.message).join(' '))
  }
  return evaluation.review
}
