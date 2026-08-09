import {
  compileResponseContract,
  evaluateResponse,
  type CandidateResponse,
  type ReviewContract,
} from '@altitutor/ucat-response-contract'
import type { RawScoreResult, ScoringQuestion } from './types'

function compiledContract(question: ScoringQuestion) {
  const result = compileResponseContract(question.definition)
  if (!result.ok) {
    throw new Error(result.issues.map((issue) => issue.message).join(' '))
  }
  return result.contract
}

/**
 * Aggregate question scores without defining marking behaviour locally. Each
 * Answer scheme delegates awarded marks, maximum marks, and review to the
 * shared response-contract evaluator.
 */
export function computeRawScore(params: {
  responses: ReadonlyMap<string, CandidateResponse>
  questions: readonly ScoringQuestion[]
}): RawScoreResult {
  const questionScores = new Map<string, number>()
  const reviews = new Map<string, ReviewContract>()
  let totalRawScore = 0
  let maximumRawScore = 0

  for (const question of params.questions) {
    const contract = compiledContract(question)
    const response =
      params.responses.get(question.definition.questionId) ??
      (contract.presentation.kind === 'single_select'
        ? { kind: 'single_select' as const, selectedOptionId: null }
        : { kind: 'placement' as const, placements: {} })
    const evaluation = evaluateResponse(contract, response)
    if (!evaluation.ok) {
      throw new Error(evaluation.issues.map((issue) => issue.message).join(' '))
    }
    questionScores.set(question.definition.questionId, evaluation.score.awarded)
    reviews.set(question.definition.questionId, evaluation.review)
    totalRawScore += evaluation.score.awarded
    maximumRawScore += evaluation.score.maximum
  }

  return { questionScores, totalRawScore, maximumRawScore, reviews }
}

export function computeMaxRawScore(
  questions: readonly ScoringQuestion[]
): number {
  return questions.reduce((total, question) => {
    const contract = compiledContract(question)
    const blankResponse =
      contract.presentation.kind === 'single_select'
        ? { kind: 'single_select' as const, selectedOptionId: null }
        : { kind: 'placement' as const, placements: {} }
    const evaluation = evaluateResponse(contract, blankResponse)
    if (!evaluation.ok) {
      throw new Error(evaluation.issues.map((issue) => issue.message).join(' '))
    }
    return total + evaluation.score.maximum
  }, 0)
}
